#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request all 
// available event types and their ID
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
        const filter = '{"filter":{}}';                           
		
		const use_compression = true;
        bfapi.listEventTypes(login_response_params.session_id,
							 config.ak,
							 filter,
							 use_compression,
							 parseListEventTypesResponse);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}

//============================================================ 
function parseListEventTypesResponse(response_params) 
{
	// Callback for when listEventTypes response is received
	// Input parameter response_params contains the following data:
	//    1. response_params.error - a boolean error flag
	//    2. response_params.error_message - string containing error details or "OK" when no error
	//    3. response_params.data - string containing the JSON response
	//    4. response_params.session_id - string storing session token value
	
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
			console.log("Available Betfair event types:");
			let result = response.result;
			let event_array = [];
			for (let event of result)
			{
				let eventtype = {};
				eventtype.eventType = event.eventType.name;
				eventtype.ID = parseInt(event.eventType.id);
				eventtype.marketCount = event.marketCount;				
				event_array.push(eventtype)				
			}	
			
			// Use console.table for nicer output
			console.table(event_array);
				
		}
	}
    else
    {
        console.log(response_params.error_message);
    }    
}
