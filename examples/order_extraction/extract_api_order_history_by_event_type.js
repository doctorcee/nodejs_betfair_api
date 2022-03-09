#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
"use strict"

const config = require('../../config.js');
var bfapi = require('../../api_ng/betfairapi.js');
var market_filters = require('../../api_ng/market_filters.js');
var file_utils = require('../../utils/file_utilities.js');
var fs = require('fs');

var year = 0;
var month = 0;
var day = 0;

var event_type_id = 0;
var start_record = 0;
const record_limit = 1000;
const use_compression = true;
var orders_array = [];
var logfile_directory = '';
var bet_status = 'SETTLED';

var market_id_array = [];
var mkt_index_iterator = 0;
const strat_refs = []
var date_string = '';

run();

//============================================================ 
function printCLIParamRequirements()
{	
	console.log("[1] - Event type ID.");		
	console.log("[2] - Year for which results are required.")	
	console.log("[3] - Month for which results are required.")	
	console.log("[4] - Day for which results are required.")
	console.log("[5] - Directory in which to save output files.")
}

//============================================================ 
function run() 
{	
	// Retrieve command line parameters
	var comm_params = process.argv.slice(2); 	
	if (comm_params.length != 5)
	{
		console.log("Error - insufficient arguments supplied. Required arguments are:");
		printCLIParamRequirements();
		process.exit(1);
	}
	event_type_id = comm_params[0];
	year = parseInt(comm_params[1]);
	month = parseInt(comm_params[2]);
	month = month - 1; 	// Month is zero based 
	day = parseInt(comm_params[3]);

	if (year < 2019 || day < 1 || day > 31 || month > 11 || month < 0)
	{
		console.log("Error - supplied date parameters are invalid");
		process.exit(1);
	}
	logfile_directory = comm_params[4]; 
	if (!fs.existsSync(logfile_directory))
	{
		fs.mkdirSync(logfile_directory);
	}
	let rmonth = month + 1;
	let mstring = rmonth < 10 ? ('0' + rmonth) : ('' + rmonth);
	let dstring = day < 10 ? ('0' + day) : ('' + day);
	date_string = '' + year + mstring + dstring;
	logfile_directory += (date_string + '/');
	if (!fs.existsSync(logfile_directory))
	{
		fs.mkdirSync(logfile_directory);
	}
	if (!fs.existsSync(logfile_directory))
	{
		console.log("ERROR unable " + logfile_directory + " does not exist.");
		process.exit(1);
	}

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
        console.log("Login successful!");               		        	
		requestClearedOrdersByMarket(login_response_params.session_id);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}

//============================================================ 
function requestClearedOrdersByMarket (session_id)
{		
	let filter = market_filters.createListClearedOrdersFilter(year,month,day,event_type_id,strat_refs,start_record,record_limit);
	bfapi.listClearedOrders(session_id,
							  config.ak,
							  filter,
							  use_compression,
							  parseListClearedOrdersGroupedByMarket);													
}

//============================================================ 
function requestClearedOrdersByBet (session_id)
{		
	let mkid = market_id_array[mkt_index_iterator];	
	let filter = '{"betStatus":"' + bet_status + '","marketIds":["' + mkid + '"]';	
	filter += (',"groupBy":"BET","fromRecord":' + start_record + '}');	
	
	bfapi.listClearedOrders(session_id,
							  config.ak,
							  filter,
							  use_compression,
							  parseListClearedOrdersGroupedByBet);													
}

//============================================================ 
function parseListClearedOrdersGroupedByBet(response_params) 
{
	// Callback for when listClearedOrders response is received
	// Results here are orders grouped BY MARKET
		
	// Parse response and write bet information to individual filenames 
	// created from the market that the bet is placed in.	
	
    if (response_params.error === false)
    {   
        let response = {};
        try
        {
            response = JSON.parse(response_params.data);
        }
        catch (ex)
        {
            console.error("Error parsing JSON response packet: " + ex.message);
            console.error("Offending packet content: " + data);
            process.exit(1);
        }
        if (bfapi.validateAPIResponse(response))
        {	
			let result = response.result;
			let orders = result.clearedOrders;
			let more_available = result.moreAvailable;
		
			const order_count = orders.length;
			//console.log("listClearedOrders response contains " + order_count + " orders.");
			for (let order of orders)
			{		
				let market_id = order.marketId;				
				var outfile = logfile_directory + market_id + "_" + bet_status + ".json";
				file_utils.appendStringToFileSync(outfile,(JSON.stringify(order) + "\n"));							
			}	
			if (more_available === true)
			{
				console.log("******** MORE RESULTS AVAILABLE!!!!!!!!!!!!");
				start_record += order_limit;
			}
			else
			{
				// no more records - change bet_status and/or market
				start_record = 0;				
				if (bet_status === "SETTLED")
				{
					bet_status = "CANCELLED";			
				}
				else if (bet_status === "CANCELLED")
				{
					bet_status = "LAPSED";
				}
				else if (bet_status === "LAPSED")
				{
					bet_status = "VOIDED";			
				}
				else if (bet_status === "VOIDED")
				{
					// Bump market iterator. Exit if we are done. Otherwise set status back to "SETTLED"
					++mkt_index_iterator;
					let z = 0;
					while (1)
					{
						++z;
						if (z > 3000000000)
						{
							break;
						}
					}
					if (mkt_index_iterator >= market_id_array.length)
					{			
						// Terminate program				
						console.log("Program finished. All markets processed.");
						process.exit(1);			
					}
					else
					{
						console.log("Processing next market (" + market_id_array[mkt_index_iterator] + ")");
						bet_status = "SETTLED";
					}
				}		
			}
		}
	}
	requestClearedOrdersByBet(response_params.session_id);
}

//============================================================ 
function parseListClearedOrdersGroupedByMarket(response_params)
{
	// Callback for when listClearedOrders response is received
	// Results here are orders grouped BY MARKET
    if (response_params.error === false)
    {   
        let response = {};
        try
        {
            response = JSON.parse(response_params.data);
        }
        catch (ex)
        {
            console.error("Error parsing JSON response packet: " + ex.message);
            console.error("Offending packet content: " + data);
            process.exit(1);
        }
        if (bfapi.validateAPIResponse(response))
        {					
			let result = response.result;
			let orders = result.clearedOrders;
			let more_available = result.moreAvailable;
			
			for (let order of orders)
			{									
				market_id_array.push(order.marketId);
			}
			
			if (more_available === true)
			{
				// Response indicates more records are available so we must call again				
				start_record += record_limit;
				requestClearedOrdersByMarket(response_params.session_id);
			}			
			else
			{
				// We have all the market results now so extracy orders BY BET per market 				
				mkt_index_iterator = 0;
				start_record = 0;				
				console.log("API reports that there are " + market_id_array.length + " markets for " + date_string);
				requestClearedOrdersByBet(response_params.session_id);
			}			
		}
	}
	else
    {
        console.log(response_params.error_message);
    }
}

/*
//============================================================ 
function getClearedOrdersByMarketGroupedByBet(session_id, app_key) 
{    	
	let options = {
		hostname: 'api.betfair.com',
		port: 443,
		path: '/exchange/betting/json-rpc/v1',		
		method: 'POST',
		headers: {
			'X-Application' : app_key,
			'Accept': 'application/json',
			'Content-type' : 'application/json',
			'X-Authentication' : session_id,
			'Connection':'Keep-Alive'
		}
    }
    if (USE_COMPRESSION)
    {
		options.headers['Accept-Encoding'] = 'gzip';
	}
	let mkid = market_id_array[mkt_index_iterator];	
	let filter = '{"betStatus":"' + bet_status + '","marketIds":["' + mkid + '"]';	
	filter += (',"groupBy":"BET","fromRecord":' + start_record + '}');	
		
	//console.log(filter);
	
	// Specifically use the parseListClearedOrdersByMarketGroupedByBet callback from this function
	listClearedOrders(session_id,app_key,options,filter,parseListClearedOrdersByMarketGroupedByBet);
}
*/





