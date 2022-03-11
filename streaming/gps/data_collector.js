#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description:
// GPS stream logger
//------------------------------------------------------

"use strict"
var tls = require('tls');
var fs = require('fs');
var bfapi = require('../../api_ng/betfairapi.js');
var file_utils = require('../../utils/file_utilities'); 
var log_utils = require("../../utils/logging_utilities.js");
var date_utils = require('../../utils/date_utilities');
const config = require('../../config.js');


var sigint_abort_flag = false;

// Connection variables
var tls_client = {};

var next_allowed_reconnection = new Date().getTime();


let connection_info = {
  connection_id : '',
  initial_clk : '',
  clk : '',
  stream_connected : false,
  connected : false,
  connecting : false,
  subscribed : false,
  subscribing : false,
  authenticated : false,
  authenticating : false,
  max_connections_reached : false,
  connections_available : -1,
  last_auth_req_id : 0,
  streaming_request_id_counter : 1,
  sid : '',
  last_heartbeat : 0
};

var lagged_message_count = 0;
var monitor_count = 0;

var current_message_string = "";

var monitor_timer = {};
var market_list = [];

var logged_in = false;


var datestring = date_utils.todaysDateAsString(); 

if (!fs.existsSync(config.logbasegps))
{
    console.log('ERROR: Directory ' + config.logbasegps + ' does not exist. Terminating program.');
    process.exit(1);
}

var errorlog = config.logbasegps + datestring + '_error_log.txt'


run();

//============================================================ 
process.on('SIGINT', function () {
	sigint_abort_flag = true;
});

//============================================================ 
function run() 
{
	// Call the bfapi module login function with the login parameters stored in config
    bfapi.login(config,loginCallback);
}

//============================================================ 
function loginCallback(login_response_params)
{
    // Login callback - will be called when bfapi.login receives a response
    // from the API or encounters an error
    if (login_response_params.error === false)
    {
		connection_info.sid = login_response_params.session_id;
		monitor_timer = setInterval(monitor,config.gpsrate); 
    }
    else
    {
        log_utils.logMessage(errorlog, login_response_params.error_message, true);
    }                                                                                                                    
}

//============================================================ 
function start_streaming()
{
	// Check for zero available connections
	if (connection_info.stream_connected === true)
	{
		let msg = "Reconnection attempt aborted: stream_connected flag is TRUE.";
		log_utils.logMessage(errorlog, msg, true);
	}
	if (connection_info.connecting === true)
	{
		let msg = "Reconnection attempt aborted: connecting flag is TRUE.";
		log_utils.logMessage(errorlog, msg, true);
	}
	if (connection_info.connected === true)
	{
		let msg = "Reconnection attempt aborted: connected flag is TRUE.";
		log_utils.logMessage(errorlog, msg, true);
	}
	if (connection_info.max_connections_reached)
	{
		let tt = new Date().getTime();
		if (tt < next_allowed_reconnection)
		{
			let msg = ("Delaying reconnection: Max connection limit has been reached.");
			log_utils.logMessage(errorlog, msg, true);	
			return;
		}
	}
	if (connection_info.connections_available < 1 && connection_info.connections_available > -1)
	{
		let msg = ("**** WARNING: There are ZERO connections available. Connection will not be attempted.");
		log_utils.logMessage(errorlog, msg, true);
		return;
	}

	var options = {
		host: config.gpsendpoint,
		port: 443
	}

	// Establish connection to the socket 
	connection_info.connecting = true;
	tls_client = tls.connect(options, function () {
		connection_info.connected = true;		
		connection_info.connecting = false;
		
		let msg = ("Connected to " + config.gpsendpoint);
		log_utils.logMessage(errorlog, msg, true);
	});
	
	tls_client.on('data', function(data) {
				
		let ts = new Date();
		let msepoch = ts.getTime();		
		connection_info.last_heartbeat = msepoch;   
		current_message_string += data;
		if (data.indexOf("\r\n") >= 0)
		{
			let lines = current_message_string.split("\r\n");
			let num_lines = lines.length;			
			for (let i = 0; i < num_lines; ++i)
			{
				let this_msg = lines[i];
				if (this_msg.length > 0)
				{															
					let response = {};
					try
					{						
						response = JSON.parse(this_msg);							
					}
					catch (ex)
					{
						// If parsing fails, its possibly because we have a partial 
						// next message. Therefore, if this is the final string in the 
						// split array, we store this portion in current_message_string	
						// and suppress the error logging as we would never expect a 
						// partial message to parse successfully.	
						if (i === num_lines-1)
						{							
							current_message_string = this_msg;
						}
						else
						{
							let msg = ("Error parsing JSON response packet : " + ex.message);
							log_utils.logMessage(errorlog, msg, true);												
							msg = "Offending packet content: " + this_msg;
							log_utils.logMessage(errorlog, msg, true);					
						}				
						// Carry on with the next message				
						continue;							
					}										
					let optype = response.op;						
					if ("connection" === optype)
					{										
						// CONNECTION MESSAGE																
						let msg = ("Connection message received: " + this_msg);
						log_utils.logMessage(errorlog, msg, true);
						if (response.connectionId != null) 	
						{
							connection_info.connection_id = response.connectionId;
							msg = ("Connection ID = " + connection_info.connection_id);
							log_utils.logMessage(errorlog, msg, true);							
							connection_info.stream_connected = true;
						}			
						else
						{
							// no connection ID ???
						}
					}
					else if ("status" === optype)
					{
						let msg = ("Status message received: " + this_msg);
						log_utils.logMessage(errorlog, msg, true);				
						processStatusMessage(response);
					}
					else if ("rcm" === optype)
					{											
						processRCM(this_msg,response,msepoch);
					}					
				}
				// clear buffer
				current_message_string = "";				
			}						
		}
	});

	tls_client.on('close', function() {
		let msg = ("TLS connection closed.");
		log_utils.logMessage(errorlog, msg, true);
		clearStateVars();		
	});

	tls_client.on('error', function(err) {
		let msg = ("TLS client error: " + err);
		log_utils.logMessage(errorlog, msg, true);
	});		
}


//============================================================ 
function clearStateVars()
{
	connection_info.connected = false;
	connection_info.connecting = false;
	connection_info.subscribed = false;
	connection_info.subscribing = false;
	connection_info.authenticated = false;
	connection_info.authenticating = false;
	connection_info.stream_connected = false;
	connection_info.connections_available = -1;
}

//============================================================ 
function processRCM(msg_string, json_msg, timestamp)
{
	//console.log(msg_string);
    
	// Split data by market
	const tnow = new Date().getTime();
	let publish_time = 0;
	if (json_msg.hasOwnProperty("pt"))
	{
		publish_time = json_msg.pt;
		const delay = tnow - publish_time;
		if (delay > 100)
		{			
			lagged_message_count++;
		}
	}
	
	if (json_msg.hasOwnProperty("initialClk"))
    {
		connection_info.initial_clk = json_msg.initialClk;
	}
	if (json_msg.hasOwnProperty("clk"))
    {
		connection_info.clk = json_msg.initialClk;
	}
	
	if (json_msg.hasOwnProperty("ct"))
    {
        if ('HEARTBEAT' === json_msg.ct)
        {                     
            return;
        }
    }
    
	const tsstring = timestamp + "|" + publish_time + "|";
	if (json_msg.hasOwnProperty("rc"))
	{
		if (Array.isArray(json_msg.rc))
		{
			const num_items = json_msg.rc.length;
			for (let i = 0; i < num_items; ++i)
			{
				let mkt = json_msg.rc[i];
				if (mkt.hasOwnProperty("mid"))
				{					
					let outfile = config.logbasegps + ((mkt.mid).replace(/\./g,'')) + '.txt';
					file_utils.appendStringToFile(outfile,(tsstring + JSON.stringify(mkt)));					
				}
				else
				{
					console.log("Message missing mid")
				}
			}
		}
	}
	else
	{
		console.log("Message missing rc field")
	}
}

//============================================================ 
function subscribe()
{	
	log_utils.logMessage(errorlog, "Subscribing....", true);	
	let gps_filter = '{"op":"raceSubscription","id":' + (++connection_info.streaming_request_id_counter);
	gps_filter += ',"heartbeatMs":' + config.gpsheartbeat;
	gps_filter += '}\r\n';
	tls_client.write(gps_filter);	
	connection_info.subscribing = true;
}

//============================================================ 
function authenticate()
{	
	//	Send authentication message 
	let auth_msg = '{"op": "authentication", "appKey": "' + config.ak;
	auth_msg += '", "session": "' + connection_info.sid + '","id":' + (++connection_info.streaming_request_id_counter) + '}\r\n';
	connection_info.last_auth_req_id = connection_info.streaming_request_id_counter;	
	log_utils.logMessage(errorlog, "Authenticating....", true);				
	connection_info.authenticating = true;
	tls_client.write(auth_msg);	
}

//============================================================ 
function monitor() 
{
	let nowstring = date_utils.todaysDateAsString(); 
	if (nowstring != datestring)
	{
		datestring = nowstring;
		errorlog = config.logbasegps + datestring + '_error_log.txt'
	}
	++monitor_count;
	let ts = new Date();
	let msepoch = ts.getTime();
	
	if (monitor_count % 1000 === 0)
	{
		var lm2 = "*** LATENCY UPDATE: Received " + lagged_message_count + " messages with receipt lag greater than 100ms since program started.";
		log_utils.logMessage(errorlog, lm2, true);
	}
	
	if (sigint_abort_flag === true)
	{
		let msg = "SIGINT recieved - clearing timer to terminate application.";
		log_utils.logMessage(errorlog, msg, true);					
		clearTimeout(monitor_timer);
		process.exit(1);
	}
	
	// Check for lockup before doing anything else
	const lag = msepoch - connection_info.last_heartbeat;
	if (lag > 2 * config.gpsheartbeat)
	{
		let msg = "*** DATA WARNING: " + lag + " milliseconds have elsapsed since receiving last stream update. Closing connection...";
		log_utils.logMessage(errorlog, msg, true);													
	}
	
	if (false === connection_info.connected)
	{
		if (false === connection_info.connecting)
		{
			start_streaming(); 
		}
	}
	else
	{
		if (connection_info.stream_connected)
		{
			if (false === connection_info.authenticated)
			{
				if (false === connection_info.authenticating)
				{
					authenticate();
				}
				else
				{
					let msg = "Authentication pending....";
					log_utils.logMessage(errorlog, msg, true);									
				}			
			}
			else
			{
				if (false === connection_info.subscribed)
				{
					if (false === connection_info.subscribing)
					{
						subscribe();
					}
				}
				else
				{
					// Check connection for lockup					
					if (lag > 2 * config.gpsheartbeat)
					{
						let msg = "*** DATA WARNING: " + lag + " milliseconds have elsapsed since receiving last stream update. Closing connection...";
						log_utils.logMessage(errorlog, msg, true);											
						tls_client.destroy();
					}
				}
			}
		}
	}
}


//============================================================ 
function processStatusMessage(json_response)
{
	var status_code = (json_response.statusCode != null) ? json_response.statusCode : "";
	var error_code  = (json_response.errorCode != null) ? json_response.errorCode : "";
	var error_msg   = (json_response.errorMessage != null) ? json_response.errorMessage : "";
	var conn_closed = (json_response.connectionClosed != null) ? json_response.connectionClosed : true;
	var ccon_id 	= (json_response.id != null) ? parseInt(json_response.id) : 0;  					
	if (status_code === "SUCCESS")
	{  
		if (ccon_id > 0)
		{
			if (true === connection_info.authenticating)	
			{
				connection_info.authenticated = (ccon_id == connection_info.last_auth_req_id);								
				connection_info.authenticating = false;
				if (connection_info.authenticated === false)
				{
					let msg = ("ERROR last authentication request id " + connection_info.last_auth_req_id + " is not equal to returned id " + ccon_id);
					log_utils.logMessage(errorlog, msg, true);
				}						
				else
				{
					// Clear the max connections flag.
					connection_info.max_connections_reached = false;
					let msg = ("Successful authentication");
					log_utils.logMessage(errorlog, msg, true);
					
					if (json_response.hasOwnProperty("connectionsAvailable"))
					{
						connection_info.connections_available = parseInt(json_response.connectionsAvailable);
						msg = ("Authentication response indicates there are " + connection_info.connections_available + " available connections.");
						log_utils.logMessage(errorlog, msg, true);	
					}
					else
					{
						msg = ("*** WARNING: Authentication success message did not contain number of available connections!");
						log_utils.logMessage(errorlog, msg, true);	
					}
				}		
			}
			else if (true === connection_info.subscribing)
			{
				// Successful subscription
				connection_info.subscribing = false;
				connection_info.subscribed = true;
				let msg = ("Successful subscription");
				log_utils.logMessage(errorlog, msg, true);
			}
		}
	}
	else if (status_code === "FAILURE")
	{
		let msg = ("FAILURE: Status: " + status_code + ", Error code: " + error_code + ", Error message: " + error_msg + " " + ccon_id);
		log_utils.logMessage(errorlog, msg, true);
		
		connection_info.authenticating = false;
		if ("MAX_CONNECTION_LIMIT_EXCEEDED" === error_code)
		{			
			msg = ("Max connection limit reached. Setting reconnection delay of 10 seconds.");
			log_utils.logMessage(errorlog, msg, true);
			connection_info.max_connections_reached = true;
			
			// Set 10 second lag on next connection attempt;
			let tt = new Date().getTime();
			next_allowed_reconnection = 10000 + tt.getTime();
		}
	}
}


