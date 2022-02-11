#!/usr/bin node
"use strict";

//------------------------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------------------------
// Description
// Module file with functions to create generic market filter JSON strings 
//------------------------------------------------------------------------

const HORSE_RACING_EVENT_TYPE_ID = 7;
const GREYHOUND_EVENT_TYPE_ID = 4339;

module.exports = {
    
    createMarketFilter: function (evid_arr, country_arr, market_type_arr, start_time, end_time, market_proj_arr, max_results) {
        // Input parameters:
        // 1. Array of event type IDs 
        // 2. Array of country codes
        // 3. Array of market types
        // 4. Start time (string in format required for API)
        // 5. End time (string in format required for API)
        // 6. Array of market projection options
        // 7. Max number of markets that can be returned in the response        
        
        let filter_string = '';
        if (evid_arr.length === 0 || country_arr.length === 0 || market_type_arr.length === 0 || start_time.length === 0)
        {
			// Minimum requirements not met - return empty string
            return filter_string;
        }
                
        filter_string += '"eventTypeIds":['; 
        for (let i = 0; i < evid_arr.length; i++)
        {
            filter_string += ('"' + evid_arr[i] + '"');
            if (i < evid_arr.length-1)
            {
                filter_string += ',';
            }
        }    
        filter_string += '],"marketCountries":['; 
        for (let i = 0; i < country_arr.length; i++)
        {
            filter_string += ('"' + country_arr[i] + '"');
            if (i < country_arr.length-1)
            {
                filter_string += ',';
            }
        }    
        filter_string += '],"marketTypeCodes":['; 
        for (let i = 0; i < market_type_arr.length; i++)
        {
            filter_string += ('"' + market_type_arr[i] + '"');
            if (i < market_type_arr.length-1)
            {
                filter_string += ',';
            }
        }    
        if (end_time.length === 0)
        {
            filter_string += ('],"marketStartTime":{"from":"' + start_time + '"}}');
        }
        else
        {
            filter_string += ('],"marketStartTime":{"from":"' + start_time + '","to":"' + end_time +'"}}');
        }   
        let mkt_proj_string = '"marketProjection":[';
        for (let i = 0; i < market_proj_arr.length; ++i)
        {			
			mkt_proj_string += ('"' + market_proj_arr[i] + '"');
            if (i < market_proj_arr.length-1)
            {
                mkt_proj_string += ',';
            }
		}
		mkt_proj_string += ']';		
		filter_string += (',"sort":"FIRST_TO_START","maxResults":' + max_results + ',' + mkt_proj_string + '}');                  
        
        let filter = '{"filter":{' + filter_string;
        return filter;                
    }
}
