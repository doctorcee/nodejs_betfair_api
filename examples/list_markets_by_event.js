#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request a list 
// of markets for the required event ID.
//------------------------------------------------------

"use strict"

const config = require('../config.js');
var bfapi = require('../api_ng/betfairapi.js');
var market_filters = require('../api_ng/market_filters.js');

var event_id = 0;

run();

//============================================================ 
function printCLIParamRequirements()
{    
    console.log("[1] - Event ID.");            
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
    event_id = comm_params[0];    
        
    bfapi.login(config,loginCallback);
}

//============================================================ 
function loginCallback(login_response_params)
{
    // Login callback - will be called when bfapi.login receives a response
    // from the API or encounters an error
    // Create the filter for listEvents operation
    if (login_response_params.error === false)
    {             
        console.log("Login successful!");                        
        
        // Create a market filter               
        let evtypes = []
        let evids = [event_id]
        let countries = []
        let comps = []
        let mkt_types = []
        
        const mkfilter = market_filters.createMarketFilterObject(evtypes, evids, countries, comps, mkt_types)               
        console.log(mkfilter)
        const market_projection = ["MARKET_DESCRIPTION","RUNNER_METADATA","MARKET_START_TIME","EVENT","COMPETITION"]
        const max_num_markets = 100;
        
        /*
        let date = new Date();        
        date.setUTCHours(23);
        date.setUTCMinutes(59);
        date.setUTCSeconds(59);9
        let end_time = date.toJSON();
        date.setUTCHours(0);
        date.setUTCMinutes(0);
        date.setUTCSeconds(0);    
        let start_time = date.toJSON();
        */                  
        
        let parameters = {}
        parameters['filter'] = mkfilter
        parameters['marketProjection'] = market_projection
        parameters['sort'] = 'FIRST_TO_START'
        parameters['maxResults'] = max_num_markets                                                 
        
        const use_compression = true;
        bfapi.listMarketCatalogue(login_response_params.session_id,
                                  config.ak,
                                  JSON.stringify(parameters),
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
    if (response_params.error === false)
    {   
        let response = {}
        try
        {
            response = JSON.parse(response_params.data);
        }
        catch (ex)
        {
            console.error("Error parsing JSON response packet: " + ex.message)
            console.error("Offending packet content: " + data)
            process.exit(1)
        }
        if (bfapi.validateAPIResponse(response))
        {                
            console.log("Available markets for event ID " + event_id + ":")
            let mklist = response.result
            if (mklist.length > 0)
            {
                let mk_array = [];
                for (let mkt of mklist)
                {
                    let new_mkt = {};                                
                    new_mkt.ID = mkt.marketId
                    new_mkt.Time = mkt.marketStartTime
                    new_mkt.Name = mkt.event.name + ' ' + mkt.marketName
                    new_mkt.Type = mkt.description.marketType
                    new_mkt.Runners = mkt.runners.length                    
                    mk_array.push(new_mkt);                
                }
                // Use console.table for nicer output
                console.table(mk_array);    
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


