#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE
// USING THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request a list
// of competition ID for the required event type.
//------------------------------------------------------

"use strict"

const config = require('../config.js')
var bfapi = require('../api_ng/betfairapi.js')
var market_filters = require('../api_ng/market_filters.js')
var event_type_id = 0

run()

//============================================================
function printCLIParamRequirements()
{
	console.log("[1] - Event type ID.")
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
        // Create a market filter
        let evtypes = [event_type_id]
        let evids = []
        let countries = []
        let comps = []
        let mkt_types = []
        
        const mkfilter = market_filters.createMarketFilterObject(evtypes, evids, countries, comps, mkt_types)
        let parameters = {}
        parameters['filter'] = mkfilter
		const use_compression = true
		
        bfapi.listCompetitions(login_response_params.session_id,
							   config.ak,
							   JSON.stringify(parameters),
							   use_compression,
							   parseListCompetitionsResponse)
    }
    else
    {
        console.log(login_response_params.error_message)
    }
}

//============================================================
function parseListCompetitionsResponse(response_params)
{
	// Callback for when listCompetitions response is received
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
			console.log("Available competitions for event type " + event_type_id + ":");
			let competitionlist = response.result;
			if (competitionlist.length > 0)
			{
				let comp_array = [];
				for (let comp of competitionlist)
				{
					let new_comp = {};
					new_comp.Competition = comp.competition.name;
					new_comp.Region = comp.competitionRegion;
					new_comp.ID = parseInt(comp.competition.id);
					new_comp.marketCount = comp.marketCount;
					comp_array.push(new_comp);
				}
				// Use console.table for nicer output
				console.table(comp_array);
			}
			else
			{
				console.log("There are no competitions for this event type.");
			}
		}
	}
	else
    {
        console.log(response_params.error_message);
    }
}
