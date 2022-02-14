#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request profits 
// at the market level for a specified month and event type.
//------------------------------------------------------

"use strict"

const config = require('../../config.js');
var bfapi = require('../../api_ng/betfairapi.js');

var month = 0;
var year = 0;
var event_type_id = 0;
var start_record = 0;
const record_limit = 1000;
const use_compression = true;
var orders_array = [];

run();

//============================================================ 
function printCLIParamRequirements()
{	
	console.log("[1] - Event type ID.");
	console.log("[2] - Year of date for which results are required.");
	console.log("[3] - Month of date for which results are required.");
}

//============================================================ 
function run() 
{	
	// Retrieve command line parameters
	var comm_params = process.argv.slice(2); 	
	if (comm_params.length != 3)
	{
		console.log("Error - insufficient arguments supplied. Required arguments are:");
		printCLIParamRequirements();
	}
	event_type_id = comm_params[0];
	year = parseInt(comm_params[1]);
	month = parseInt(comm_params[2]);		
	month = month - 1;
	if (year < 2019 || month < 0 || month > 11)
	{
		console.log("Error - supplied date parameters are invalid");
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
 
		requestClearedOrders(login_response_params.session_id,year,month);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}

//============================================================ 
function requestClearedOrders (session_id,year,month)
{	
	// Work out end day - note that month is ZERO based index!
	let end_day = 31;
	if (month === 1)
	{
		if (year % 4 === 0)
		{
			end_day = 29;
		}
		else
		{
			end_day = 28;
		}
	}
	else
	{
		if (month === 3 || month === 5 || month === 8 || month == 10)
		{
			end_day = 30;
		}
	}
	let date_start = new Date(year, month, 1, 0, 0, 1, 0);
	let date_end = new Date(year, month, end_day, 23,59, 59, 0);
	
	let json_date_start = date_start.toJSON();	
	let json_date_end = date_end.toJSON();
	
	let filter = '{"betStatus":"SETTLED","eventTypeIds":["' + event_type_id + '"],"groupBy":"MARKET"';	
	filter += ',"fromRecord":' + start_record + ',"recordCount":' + record_limit;
	filter += ',"settledDateRange":{"from":"'+json_date_start+'","to":"'+json_date_end+'"},"includeItemDescription":true}';			
			
	bfapi.listClearedOrders(session_id,
							  config.ak,
							  filter,
							  use_compression,
							  parseListClearedOrders);
}

//============================================================ 
function calculateProfitHistory()
{
	// Process the info in the orders_array which contains 
	// the profits for the month
	let total_bets = 0;
	let total_markets = 0;	
	let total_commission = 0.0;	
	let market_profit = 0.0;
	let cumulative_profit = 0.0;
	
	for (let order of orders_array)
	{
		// Process each market result		
		let marketid = order.marketId;
		let desc = order.itemDescription;
		let evdesc = desc.eventDesc;			
		let profit = order.profit;				
		let commission = order.commission;
		market_profit += profit;
		let profit_string = "£" + Math.abs(profit);			
		if (profit < 0)
		{
			profit_string = "-" + profit_string;
		}
		else
		{
			profit_string = " " + profit_string;
		}
		total_bets += order.betCount;
		total_commission += commission;		
		let line = "[" + order.settledDate + "]  " + profit_string + " \t(" + evdesc + "), Market " + marketid + ", Total bets = " +  order.betCount + ", commission paid £" + commission;
		console.log(line);		
		total_markets++;		
		cumulative_profit += profit;
	}
	console.log("Total profit across all markets: £" + cumulative_profit + " Commission paid: £" + total_commission);
	console.log("Total bets: " + total_bets);
	console.log("Total markets: " + total_markets);
}

//============================================================ 
function parseListClearedOrders(response_params)
{
	// Callback for when listClearedOrders response is received
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
				orders_array.push(order);
			}
			if (more_available === true)
			{
				// Response indicates more records are available so we must call again				
				start_record += record_limit;
				requestClearedOrders(response_params.session_id,year,month);
			}
			else
			{
				calculateProfitHistory();
			}			
		}
	}
	else
    {
        console.log(response_params.error_message);
    }
	
}
