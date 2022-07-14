#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request a list
// of events for the required event type ID.
//------------------------------------------------------


"use strict"
const config = require('../config.js');
var bfapi = require('../api_ng/betfairapi.js');
var market_filters = require('../api_ng/market_filters.js');
var event_type_id = 0;

run();


//============================================================
function printCLIParamRequirements()
{
	console.log("[1] - Event type ID.");
}

//============================================================
function run()
{
	// Retrieve command line parameters
	var comm_params = process.argv.slice(2);
	if (comm_params.length != 1)
	{
		console.log("Error - insufficient arguments supplied. Required arguments are:");
		printCLIParamRequirements();
		process.exit(1);
	}
	event_type_id = comm_params[0];
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
        // Create a market filter
        let evtypes = [event_type_id]
        let evids = []
        let countries = []
        let comps = []
        let mkt_types = [] // "marketBettingTypes":["ODDS"]
        
        const mkfilter = market_filters.createMarketFilterObject(evtypes, evids, countries, comps, mkt_types)
        let parameters = {}
        parameters['filter'] = mkfilter
		const use_compression = true;
		
        bfapi.listEvents(login_response_params.session_id,
						 config.ak,
						 JSON.stringify(parameters),
						 use_compression,
						 parseListEventsResponse);
    }
    else
    {
        console.log(login_response_params.error_message);
    }
}

//============================================================
function parseListEventsResponse(response_params)
{
	// Callback for when listEvents response is received
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
			console.log("Available events for event type " + event_type_id + ":");
			let eventlist = response.result;
			if (eventlist.length > 0)
			{
				let event_array = [];
				for (let evt of eventlist)
				{
					let new_event = {};
					new_event.Name = evt.event.name;
					new_event.Country = evt.event.countryCode;
					new_event.ID = parseInt(evt.event.id);
					new_event.marketCount = evt.marketCount;
					event_array.push(new_event);
				}
				// Use console.table for nicer output
				console.table(event_array);
			}
			else
			{
				console.log("There are no events for this event type.");
			}
		}
	}
	else
    {
        console.log(response_params.error_message);
    }
}
