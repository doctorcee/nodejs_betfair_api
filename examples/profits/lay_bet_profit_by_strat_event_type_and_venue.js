#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request profits 
// at the market level for a specified year/month/date 
// event type and (optional) list of strategy reference
// strings.
// It will also (optionally) regexp match a string pattern
// for venue (or any other string in the event description)
// of interest and display only those results that match
//------------------------------------------------------

"use strict"

const config = require('../../config.js');
var bfapi = require('../../api_ng/betfairapi.js');
var market_filters = require('../../api_ng/market_filters.js');

var event_filter = "";
var year = 0;
var month = -1;
var day = 0;
var event_type_id = 0;
var start_record = 0;
const record_limit = 1000;
const use_compression = true;
var orders_array = [];
var strat_refs = [];

run();

//============================================================ 
function printCLIParamRequirements()
{	
	console.log("[1] - Event type ID (ignored if zero)");		
	console.log("[2] - Year for which results are required.")	
	console.log("[3] - Month for which results are required (set to zero to get results for entire year.)")	
	console.log("[4] - Day for which results are required (set to zero to get results for whole month or year.)")
	console.log("[5] - Event description filter (if blank no filtering applied.)")	
	console.log("[6] - Strategy reference strings (comma delimited string of strategy refs - if blank no strategies are requested.)")	
}

//============================================================ 
function run() 
{	
	// Retrieve command line parameters
	var comm_params = process.argv.slice(2); 	
	if (comm_params.length != 6)
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
	event_filter = comm_params[4];	
	let strat_list = comm_params[5];
	if (strat_list.length > 0)
	{
		strat_refs = strat_list.split(",");
	}
	if (year < 2019 || day < 0 || day > 31 || month > 11)
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
		requestClearedOrders(login_response_params.session_id);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}

//============================================================ 
function requestClearedOrders (session_id)
{		
	let filter = market_filters.createListClearedOrdersFilterBySide(year,month,day,event_type_id,strat_refs,start_record,record_limit,"LAY");
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
	let cumulative_profit = 0.0;
	
	let profit_array = [];
	for (let order of orders_array)
	{
		// Process each market result		
		let marketid = order.marketId;
		let desc = order.itemDescription;
		let evdesc = desc.eventDesc;
		let profit = order.profit;						
		
		total_bets += order.betCount;		
		total_markets++;		
		cumulative_profit += profit;
		
		let new_item = {};
		new_item.SettledDate = order.settledDate;
		new_item.Profit = profit;
		new_item.Description = evdesc;
		new_item.Market	= marketid;
		new_item.Bets = order.betCount;		
				
		profit_array.push(new_item);
	}
	console.table(profit_array);
	console.log("Total profit across all markets: £" + cumulative_profit + " (excludes commission)");
	console.log("Total bets: " + total_bets);
	console.log("Total markets: " + total_markets);
	console.log("Strategy refs: " + strat_refs);
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
				let desc = order.itemDescription;
				let evdesc = desc.eventDesc;
				if ((event_filter !== "") && (-1 === evdesc.search(event_filter)))
				{
					// Ignore - no match on event filter
					continue;
				}
				orders_array.push(order);
			}
			if (more_available === true)
			{
				// Response indicates more records are available so we must call again				
				start_record += record_limit;
				requestClearedOrders(response_params.session_id,year);
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
