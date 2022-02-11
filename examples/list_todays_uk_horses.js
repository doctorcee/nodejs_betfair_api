#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request todays
// GB horse racing win markets. Will then print races and
// runners to the console. Response is requested as being 
// returned gzip compressed.
//------------------------------------------------------

"use strict"

const config = require('../config.js');
var bfapi = require('../api_ng/betfairapi.js');
var market_filters = require('../api_ng/market_filters.js');

run();


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
        console.log("Login successful!");
        
        // Create a market filters now 
        let event_types = [7];               
        let countries = ["GB","IE"];
        let market_types = ["WIN"]; 
        let market_projection = ["MARKET_DESCRIPTION","RUNNER_METADATA","MARKET_START_TIME","EVENT","COMPETITION"];
        let date = new Date();        
        date.setUTCHours(23);
        date.setUTCMinutes(59);
        date.setUTCSeconds(59);
        let end_time = date.toJSON();
        date.setUTCHours(0);
        date.setUTCMinutes(0);
        date.setUTCSeconds(0);    
        let start_time = date.toJSON();
        const max_num_markets = 200;
        const filter = market_filters.createMarketFilter(event_types,
                                                         countries,
                                                         market_types,
                                                         start_time,
                                                         end_time,
                                                         market_projection,
                                                         max_num_markets);                                
		
		const use_compression = true;
        bfapi.listMarketCatalogue(login_response_params.session_id,
								  config.ak,
								  filter,
								  use_compression,
								  parseListMarketCatResponse);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
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
	
	console.log("parseListMarketCatResponse() - callback executing.");
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
			let market_array_length = result.length;
			let todays_races = [];
			let todays_races_with_runners = [];		
			
			for (let i = 0; i < market_array_length; i++) 
			{
				let market = {};
				market.id = result[i].marketId;
				market.marketName = result[i].event.name + ' ' + result[i].marketName;
				let starttime = new Date(result[i].marketStartTime);
				let tm = '';
				let vhour = starttime.getUTCHours();
				if (vhour < 10)
				{
					tm += ('0' + vhour + ':');
				}
				else
				{
					tm += (vhour + ':');
				}
				let vmin = starttime.getUTCMinutes();
				if (vmin < 10)
				{
					tm += ('0' + vmin);
				}
				else
				{
					tm += vmin;
				}
				
				market.startTime = tm
				market.type = result[i].description.marketType;	
				market.numSelections = result[i].runners.length;			
				let market_string = (market.startTime + ' - ' + market.marketName + ', ID = ' + market.id);	
				todays_races.push(market_string);
				todays_races_with_runners.push(market_string);
				console.log(market_string);
				for (let jk = 0; jk < market.numSelections; jk++)
				{
					let selection = {};
					selection.id = result[i].runners[jk].selectionId;
					selection.runnerName = result[i].runners[jk].runnerName;
					let runner_string = ("\t" + selection.runnerName + ' = ' + selection.id);
					todays_races_with_runners.push(runner_string);
				}	
				
			}
			for (let k = 0; k < todays_races_with_runners.length; ++k)
			{
				console.log(todays_races_with_runners[k]);				
			}			
		}
	}
    else
    {
        console.log(response_params.error_message);
    }    
}

