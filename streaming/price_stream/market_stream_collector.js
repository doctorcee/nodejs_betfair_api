#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description:
// Betfair price stream logger
//------------------------------------------------------

"use strict"
var tls = require('tls');
var fs = require('fs');
var bfapi = require('../../api_ng/betfairapi.js');
var file_utils = require('../../utils/file_utilities'); 
var log_utils = require("../../utils/logging_utilities.js");
var date_utils = require('../../utils/date_utilities');
const config = require('../../config.js');
const price_stream_config = require('./price_stream_config.js');


var sigint_abort_flag = false;

// Connection variables
var tls_client = {};

const closed_market_check_interval_ms = 60000;
var next_allowed_reconnection = new Date().getTime();
var next_closed_market_check = new Date().getTime();
next_closed_market_check += closed_market_check_interval_ms;

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
  resub_needed : false,
  connections_available : -1,
  last_auth_req_id : 0,
  streaming_request_id_counter : 1,
  sid : '',
  last_heartbeat : 0,
  last_keepalive : 0,
  last_lmc_update : 0
};

var lagged_message_count = 0;
var monitor_count = 0;

var current_message_string = "";

var monitor_timer = {};
let current_markets = new Map();
let lmc_update_list = new Set();

let closed_market_list = new Set();

var logged_in = false;

var datestring = date_utils.todaysDateAsString(); 

if (!fs.existsSync(config.priceStreamLoggingBase))
{
    console.log('ERROR: Directory ' + config.priceStreamLoggingBase + ' does not exist. Terminating program.');
    process.exit(1);
}

var errorlog = config.priceStreamLoggingBase + datestring + '_error_log.txt'

run()

//============================================================ 
process.on('SIGINT', function () {
	sigint_abort_flag = true;
});

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
function run() 
{
	// Call the bfapi module login function with the login parameters stored in config
	// Create closed file target directory in case it does not exist
	if (fs.existsSync(config.closedMarketDestinationDirectory) === false)
	{
		fs.mkdirSync(config.closedMarketDestinationDirectory, { recursive: true });
	}
	if (fs.existsSync(config.closedMarketDestinationDirectory) == false)
	{
		logMessage(errorlog, "Error - unable to create closed market file directory " + config.closedMarketDestinationDirectory, true);
		process.exit(1);
	}
	
    bfapi.login(config,loginCallback);
}

//============================================================ 
function loginCallback(login_response_params)
{
    // Login callback - will be called when bfapi.login receives a response
    // from the API or encounters an error
    if (login_response_params.error === false)
    {
		let ts = new Date();
		let msepoch = ts.getTime();	
		connection_info.sid = login_response_params.session_id;
		connection_info.last_keepalive = msepoch;
		connection_info.last_lmc_update = msepoch;
		monitor_timer = setInterval(monitor,price_stream_config.priceStreamMonitorRate); 
    }
    else
    {
        log_utils.logMessage(errorlog, login_response_params.error_message, true);
    }                                                                                                                    
}

//============================================================ 
function keepAliveCallback(response_params)
{
    // Login callback - will be called when bfapi.login receives a response
    // from the API or encounters an error
    if (response_params.error === false)
    {
		let ts = new Date();
		let msepoch = ts.getTime();	
		connection_info.sid = response_params.token;
		connection_info.last_keepalive = msepoch;		
		log_utils.logMessage(errorlog, "Successful keepAlive request made.",false);
    }
    else
    {
		log_utils.logMessage(errorlog, "KeepAlive call status = " + response_params.status, false);
        log_utils.logMessage(errorlog, response_params.error_message, false);
    }                                                                                                                    
}

//============================================================ 
function authenticate()
{	
	//	Send authentication message 
	let auth_msg = '{"op": "authentication", "appKey": "' + config.ak;
	auth_msg += '", "session": "' + connection_info.sid + '","id":' + (++connection_info.streaming_request_id_counter) + '}\r\n';
	connection_info.last_auth_req_id = connection_info.streaming_request_id_counter;	
	log_utils.logMessage(errorlog, "Authenticating....", false);				
	connection_info.authenticating = true;
	tls_client.write(auth_msg);	
}

//============================================================ 
function subscribe()
{
	var resub = false;
	let id_counter = connection_info.streaming_request_id_counter;
	if (true === connection_info.resub_needed)
	{
		if (connection_info.initial_clk.length > 0 && connection_info.clk.length > 0)
		{
			// resub
			resub = true;
		}
	}
	if (false === resub)
	{
		// Use new ID for a clean subscription
		++id_counter;
	}
	
	
	let market_filter = {
		"marketTypes":price_stream_config.marketTypeArray,
		"countryCodes":price_stream_config.countryCodeArray,
		"eventTypeIds":price_stream_config.eventTypeIDArray
	};
	let market_data_filter = {
		"ladderLevels": price_stream_config.priceLadderLevels,
		"fields":price_stream_config.streamFieldsArray		
	};
	let filter = {
		"op":"marketSubscription",
		"id":id_counter,
		"heartbeatMs":price_stream_config.priceStreamHeartbeat,
		"marketFilter":market_filter,
		"marketDataFilter":market_data_filter
	};

	if (false === resub)
	{		
		log_utils.logMessage(errorlog, "Subscribing....", false);	
	}
	else
	{
		log_utils.logMessage(errorlog, "Re-subscribing....", true);			
		filter["initialClk"] = connection_info.initial_clk;
		filter["clk"] = connection_info.clk;		
	}
	tls_client.write(JSON.stringify(filter) + '\r\n');
	connection_info.subscribing = true;
}


//============================================================ 
function parseListMarketCatResponse(response_params) 
{
	// Callback for when listMarketCatalogue response is received
	// Input parameter response_params contains the following data:
	//    1. response_params.error - a boolean error flag
	//    2. response_params.error_message - string containing error details or "OK" when no error
	//    3. response_params.data - string containing the JSON response
	//    4. response_params.session_id - string storing session token value
	let ts = new Date();
	let msepoch = ts.getTime();	
	const tsstring = msepoch + "|MARKETCATALOG|";
    if (response_params.error === false)
    {   
        let response = {};
        try
        {
            response = JSON.parse(response_params.data);
        }
        catch (ex)
        {
            let msg = ("JSON parsing error for listMarketCatalogue response packet: " + ex.message);
            log_utils.logMessage(errorlog, msg, true);                        
        }
        if (bfapi.validateAPIResponse(response))
        {
			let result = response.result;
			let market_array_length = result.length;		
			for (let i = 0; i < market_array_length; i++) 
			{				
				const mid = result[i].marketId;				
				if (current_markets.has(mid))
				{								
					current_markets.get(mid).lastStreamUpdate = msepoch;
					current_markets.get(mid).needsLMCUpdate = false;										
					if (lmc_update_list.has(mid))
					{
						lmc_update_list.delete(mid);						
					}					
					file_utils.appendStringToFile(current_markets.get(mid).streamLog,(tsstring + JSON.stringify(result[i])));	
				}																	
			}					
		}
	}
    else
    {
        console.log(response_params.error_message);
    }    
}

//============================================================ 
function monitor() 
{	
	let nowstring = date_utils.todaysDateAsString(); 
	if (nowstring != datestring)
	{
		datestring = nowstring;
		errorlog = config.priceStreamLoggingBase + datestring + '_error_log.txt'
	}
	++monitor_count;
	let ts = new Date();
	let msepoch = ts.getTime();
	
	if (msepoch - connection_info.last_keepalive > 14400000)	
	{
		bfapi.keepAlive(connection_info.sid,config.ak,keepAliveCallback);
	}
	

	if (monitor_count % 1000 === 0)
	{
		var lm2 = "*** LATENCY UPDATE: Received " + lagged_message_count + " messages with receipt lag greater than 100ms since program started.";
		log_utils.logMessage(errorlog, lm2, false);
	}
	
	if (sigint_abort_flag === true)
	{
		let msg = "SIGINT recieved - clearing timer to terminate application.";
		log_utils.logMessage(errorlog, msg, true);					
		clearTimeout(monitor_timer);
		process.exit(1);
	}

	// Check for LMC updates required every 10 seconds
	if (msepoch - connection_info.last_lmc_update > 10000)
	{
		if (lmc_update_list.size > 0)
		{
			let mkupdate_list = [];
			for (let item of lmc_update_list.values()) 
			{
				mkupdate_list.push(item);
				if (mkupdate_list.length >= 50)
				{
					break;
				}
			}											
			let request = {};
			let filter = {};
			filter["marketIds"] = mkupdate_list;			
			for (let i = 0; i < mkupdate_list.length; ++i)
			{
				lmc_update_list.delete(mkupdate_list[i]);
			}
			request["filter"] = filter;
			request["maxResults"] = 100;
			
			request["marketProjection"] = ["MARKET_DESCRIPTION","RUNNER_METADATA","MARKET_START_TIME","EVENT","COMPETITION","EVENT_TYPE"];
			request["sort"] = "FIRST_TO_START";       			
			const request_string = JSON.stringify(request);			
			bfapi.listMarketCatalogue(connection_info.sid,config.ak,request_string,true,parseListMarketCatResponse);
		}
		connection_info.last_lmc_update = msepoch;
	}
	if (msepoch > next_closed_market_check)
	{
		// Copy markets that have been closed for more than 30 minutes to the closed market folder
		for (let mid of closed_market_list.values()) 
		{
			if (current_markets.has(mid))
			{
				const closed_ts = current_markets.get(mid).closedTimestamp;
				if (closed_ts > 0)
				{
					let msg = ("Market ID " + mid + " is now closed.");
					log_utils.logMessage(errorlog, msg, false);	
				}
				if (msepoch - closed_ts > 10000)
				{
					// Async copy the file to target directory					
					const sourcefile = current_markets.get(mid).streamLog;
					const destfile = config.closedMarketDestinationDirectory + '/' + (mid.replace(/\./g,'')) + '.txt';
					let msg = "Copying " + sourcefile + " to " + destfile;
					log_utils.logMessage(errorlog, msg, false);										
					fs.copyFile(sourcefile,destfile, (err) => {												
						if (err) {
							console.log("File copy error: ", err);
						}
					});
					current_markets.delete(mid);
					
				}
			}			
		}
		
		next_closed_market_check += closed_market_check_interval_ms;
	}
		
	// Check for lockup before doing anything else
	const lag = msepoch - connection_info.last_heartbeat;
	if (lag > price_stream_config.priceStreamHeartbeat)
	{
		let msg = "*** DATA WARNING: " + lag + " milliseconds have elsapsed since receiving last stream update.";
		log_utils.logMessage(errorlog, msg, false);													
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
					log_utils.logMessage(errorlog, msg, false);									
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
					if (lag > 2 * price_stream_config.priceStreamHeartbeat)
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
					log_utils.logMessage(errorlog, msg, false);
					
					if (json_response.hasOwnProperty("connectionsAvailable"))
					{
						connection_info.connections_available = parseInt(json_response.connectionsAvailable);
						msg = ("Authentication response indicates there are " + connection_info.connections_available + " available connections.");
						log_utils.logMessage(errorlog, msg, false);	
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
				log_utils.logMessage(errorlog, msg, false);
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

//============================================================ 
function start_streaming()
{
	// Check for zero available connections
	if (connection_info.stream_connected === true)
	{
		let msg = "Reconnection attempt aborted: stream_connected flag is TRUE.";
		log_utils.logMessage(errorlog, msg, false);
	}
	if (connection_info.connecting === true)
	{
		let msg = "Reconnection attempt aborted: connecting flag is TRUE.";
		log_utils.logMessage(errorlog, msg, false);
	}
	if (connection_info.connected === true)
	{
		let msg = "Reconnection attempt aborted: connected flag is TRUE.";
		log_utils.logMessage(errorlog, msg, false);
	}
	if (connection_info.max_connections_reached)
	{
		let tt = new Date().getTime();
		if (tt < next_allowed_reconnection)
		{
			let msg = ("Delaying reconnection: Max connection limit has been reached.");
			log_utils.logMessage(errorlog, msg, false);	
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
		host: price_stream_config.priceStreamEndpoint,
		port: 443
	}

	// Establish connection to the socket 
	connection_info.connecting = true;
	tls_client = tls.connect(options, function () {
		connection_info.connected = true;		
		connection_info.connecting = false;
		
		let msg = ("Connected to " + price_stream_config.priceStreamEndpoint);
		log_utils.logMessage(errorlog, msg, false);
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
							log_utils.logMessage(errorlog, msg, false);					
						}				
						// Carry on with the next message				
						continue;							
					}										
					let optype = response.op;						
					if ("connection" === optype)
					{										
						// CONNECTION MESSAGE																
						let msg = ("Connection message received: " + this_msg);
						log_utils.logMessage(errorlog, msg, false);
						if (response.connectionId != null) 	
						{
							connection_info.connection_id = response.connectionId;
							msg = ("Connection ID = " + connection_info.connection_id);
							log_utils.logMessage(errorlog, msg, false);							
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
						log_utils.logMessage(errorlog, msg, false);				
						processStatusMessage(response);
					}					
					else if ("mcm" === optype)
					{											
						processMCM(this_msg,response,msepoch);
					}			
				}
				// clear buffer
				current_message_string = "";				
			}						
		}
	});

	tls_client.on('close', function() {
		let msg = ("TLS connection closed.");
		log_utils.logMessage(errorlog, msg, false);
		clearStateVars();		
		connection_info.resub_needed = true;
	});

	tls_client.on('error', function(err) {
		let msg = ("TLS client error: " + err);
		log_utils.logMessage(errorlog, msg, false);
	});		
}


//============================================================ 
function processMCM(msg_string, json_msg, timestamp)
{
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
		connection_info.clk = json_msg.clk;
	}
	
	if (json_msg.hasOwnProperty("ct"))
    {
        if ('HEARTBEAT' === json_msg.ct)
        {                     
            return;
        }
    }
    
    const tsstring = timestamp + "|" + publish_time + "|";
	if (json_msg.hasOwnProperty("mc"))
	{
		if (Array.isArray(json_msg.mc))
		{
			const num_items = json_msg.mc.length;
			for (let i = 0; i < num_items; ++i)
			{
				let mkt = json_msg.mc[i];
				if (mkt.hasOwnProperty("id"))
				{				
					// TODO: STORE MARKET VERSION FOR USE BY LISTMARKETCAT MONITORS	
					let marketid = mkt.id;
					if (false == current_markets.has(marketid))
					{								
						let new_market = {};
						new_market.id = marketid;
						const outfile = config.priceStreamLoggingBase + (marketid.replace(/\./g,'')) + '.txt';
						new_market.streamLog = outfile;												
						new_market.needsLMCUpdate = true;
						new_market.marketVersion = 0;
						new_market.marketStatus = "UNKNOWN";
						new_market.closedTimestamp = 0;
						current_markets.set(marketid, new_market);	
						lmc_update_list.add(marketid);					
					}
					current_markets.get(marketid).lastStreamUpdate = timestamp;											
					file_utils.appendStringToFile(current_markets.get(marketid).streamLog,(tsstring + JSON.stringify(mkt)));					
					
					if (mkt.hasOwnProperty("marketDefinition"))
					{
						if (mkt.marketDefinition.hasOwnProperty("status"))
						{
							const mstat = mkt.marketDefinition.status;
							if (current_markets.has(marketid))
							{
								if (mstat === "CLOSED")
								{
									current_markets.get(marketid).closedTimestamp = tnow;
									closed_market_list.add(marketid);
								}
								current_markets.get(marketid).status = mstat;
							}
							/*
							current_markets.get(marketid).marketVersion = newstat;
							if (mkt.marketDefinition.status === "CLOSED")
							{								
								let msg = ("Market ID " + marketid + " is now closed.");
								log_utils.logMessage(errorlog, msg, false);								
								current_markets.delete(marketid);
							}
							*/
						}
						if (mkt.marketDefinition.hasOwnProperty("version"))
						{
							if (current_markets.has(marketid))
							{
								// Only perform LMC if market is NOT closed
								if (current_markets.get(marketid).status !== "CLOSED")
								{
									const newmv = mkt.marketDefinition.version;
									if (newmv != current_markets.get(marketid).marketVersion)
									{
										current_markets.get(marketid).marketVersion = newmv;
										lmc_update_list.add(marketid);
										current_markets.get(marketid).needsLMCUpdate = true;
									}
								}
							}
						}						
					}																								
				}
				else
				{
					console.log("Message missing market id")
				}
			}
		}
	}
	else
	{
		console.log("Message missing mc field")
	}
}


