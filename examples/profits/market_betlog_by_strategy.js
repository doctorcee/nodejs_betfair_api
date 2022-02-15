#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request profits 
// at the bet level for a specified market ID and 
// (optionally) a strategy reference string. 
//------------------------------------------------------

"use strict"

const config = require('../../config.js');
var bfapi = require('../../api_ng/betfairapi.js');
var market_filters = require('../../api_ng/market_filters.js');

var market_id = "";
var strategy_ref = "";
var start_record = 0;
const record_limit = 1000;
const use_compression = true;
var orders_array = [];

run();

//============================================================ 
function printCLIParamRequirements()
{	
	console.log("[1] - Customer strategy reference string");		
	console.log("[2] - Market ID required.")
}

//============================================================ 
function run() {
	// Retrieve command line parameters
    var comm_params = process.argv.slice(2); 
    if (comm_params.length != 2)
    {
		console.log("Error - insufficient arguments supplied. Required arguments are:");
		printCLIParamRequirements();
		process.exit(1);
	}
	strategy_ref = comm_params[0];	
	market_id = comm_params[1];
	
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
		requestClearedOrders(login_response_params.session_id,market_id,strategy_ref);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}

//============================================================ 
function requestClearedOrders (session_id,mk_id,strategy)
{		
	
		
	let filter = '{"betStatus":"SETTLED","marketIds":["' + mk_id + '"]';
	if (strategy.length > 0)
	{
		filter += ',"customerStrategyRefs":["' + strategy + '"]';
	}
	filter += ',"groupBy":"BET"}';	
	bfapi.listClearedOrders(session_id,
							  config.ak,
							  filter,
							  use_compression,
							  parseListClearedOrders);													
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

//============================================================ 
function calculateProfitHistory()
{
	// Process the info in the orders_array which contains 
	// the profits for the month
	let total_bets = 0;	
	let market_profit = 0.0;
	console.log("Market order summary for market ID " + market_id + " (strategy reference " + strategy_ref + " :\n");
	for (let order of orders_array)
	{		
		let selid = order.selectionId;			
		let placedate = order.placedDate;
		let side = order.side;
		let outcome = order.betOutcome;
		let profit = order.profit;
		let odds = order.priceRequested;
		let match_odds = order.priceMatched;
		let size = order.sizeSettled;
		let size_canc = order.sizeCancelled;
		let order_ref = order.customerOrderRef;			
		market_profit += profit;
		
		total_bets++;
		let line = "[" + total_bets + "]:\t" + order_ref + "\t placed at " + placedate + " " + outcome + ". Selection " + selid + "(" + side + " @ Ask price " + odds + " for £" + size + " [matched @ " + match_odds + "]). Profit £" + profit;
		console.log(line);	
		
	}
	
	console.log("\n********* Profit: " + market_profit + " GBP");
	console.log("********* Total orders count: " + total_bets);			
}

