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
const CRICKET_EVENT_TYPE_ID = 4;
const GREYHOUND_EVENT_TYPE_ID = 4339;

module.exports = {
	
	createMarketFilterObject: function (evtype_id_arr, evid_arr, country_arr, comp_ids, market_type_arr, start_time, end_time) {
		// Create a MarketFilter instance with supplied characteristics
		// Input parameters:
        // 1. Array of event type IDs 
        // 2. Array of event IDs
        // 3. Array of country codes
        // 4. Array of market types
        // 5. Start time (Date object) OPTIONAL
        // 6. End time (Date object)   OPTIONAL
        
        let market_filter = {}
        if (evtype_id_arr.length > 0)
        {
			market_filter['eventTypeIds'] = evtype_id_arr
		}
		if (evid_arr.length > 0)
        {
			market_filter['eventIds'] = evid_arr
		}
		if (country_arr.length > 0)
        {
			market_filter['marketCountries'] = country_arr
		}
		if (comp_ids.length > 0)
        {
			market_filter['competitionIds'] = comp_ids
		}
		if (market_type_arr.length > 0)
        {
			market_filter['marketTypeCodes'] = market_type_arr
		}
		if (start_time !== undefined)
		{
			let date_range = {}
			date_range['from'] = start_time.toJSON()
			if (end_time !== undefined)
			{
				date_range['to'] = end_time.toJSON()
			}
			market_filter['marketStartTime'] = date_range
		}
		return market_filter
	},
    
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
    },
   
    createListClearedOrdersFilter : function (year,month,day,event_type_id,strategy_ref_array,start_record,record_limit,side)
    {
		// Month is supplied as a ZERO based integer so JANUARY == 0 etc.
		let filter_string = '';
		let from_date = {};
		let to_date = {};
		if (year > 0)
		{
			// If day === 0 we create a filter for the whole month
			if (month < 0)
			{
				// Pull entire year of results
				let date_start = new Date(year, 0, 1, 0, 0, 1, 0);
				let date_end = new Date(year, 11, 31, 23,59, 59, 0);
				to_date = date_end.toJSON();
				from_date = date_start.toJSON();
			}
			else
			{
				if (day === 0)
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
					to_date = date_end.toJSON();
					from_date = date_start.toJSON();
				}
				else
				{
					// Specific date
					let date_start = new Date(year, month, day, 0, 0, 1, 0);
					let date_end = new Date(year, month, day, 23,59, 59, 0);
					to_date = date_end.toJSON();
					from_date = date_start.toJSON();
				}
			}			
			let filter = {};
			filter["betStatus"] = "SETTLED";				
			if (event_type_id > 0)
			{
				let evtype_arr = [];
				evtype_arr.push(event_type_id.toString());
				filter["eventTypeIds"] = evtype_arr;				
			}			
			if (strategy_ref_array.length > 0)
			{
				filter["customerStrategyRefs"] = strategy_ref_array;				
			}			
			filter["fromRecord"] = start_record;
			filter["recordCount"] = record_limit;
			let sdr = {}
			sdr["from"] = from_date;
			sdr["to"] = to_date;
			filter["settledDateRange"] = sdr;
			filter["includeItemDescription"] = true;
			if (side === undefined) 
			{
				filter["groupBy"] = "MARKET";	
			}
			else
			{				
				filter["side"] = side;
				filter["groupBy"] = "SIDE";	
			}			
			filter_string = JSON.stringify(filter);
		}
		return filter_string;
	}
}
