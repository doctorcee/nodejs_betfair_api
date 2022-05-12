#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description:
// Parse stream files  - check for market closure. If closed
// relocate to an organised directory structure that is date
// and country based organised around scheduled start time
//------------------------------------------------------

"use strict"
var fs = require('fs');
const path = require("path");
const config = require('../../config.js');

run();

//============================================================ 
function processFile(value) 
{
	if (fs.existsSync(value))
	{
		console.log("Processing " + value);
		let market_id = "";
		let market_start = "";
		let market_status = "";
		let venue = "";
		let country = "";
		let event_type_id = "0";		
		var filebuf = fs.readFileSync(value, "utf8");		
		var line_array = filebuf.split("\n");		
		const num_lines = line_array.length;		
		for (var i = 0; i < num_lines; i++) 
		{	
			const this_line = line_array[i];			
			if (this_line.length > 0)
			{	
				let linesplit = this_line.split('|');
				if (linesplit.length === 3)
				{
					if (linesplit[1] == "MARKETCATALOG")
					{
						continue;
					}
					let json = {};
					try
					{
						json = JSON.parse(linesplit[2]);
					}
					catch (ex)
					{
						console.log(filedata);
						console.log("ERROR: JSON parsing error " + "[" + ex.message + "]");
						console.log("File " + value + " contains invalid data and will be ignored.");
						break;
					}
					if (json.hasOwnProperty("id"))
					{
						if (market_id === "")
						{
							market_id = json.id;						
						}
						else
						{
							if (json.id !== market_id)
							{
								console.log("ERROR: Market ID has changed from " + market_id + " to " + json.id + " in file " + value);
								console.log("File " + value + " contains invalid data and will be ignored.");
								break;
							}
						}
					}
					if (json.hasOwnProperty("marketDefinition"))
					{
						if (json.marketDefinition.hasOwnProperty("status"))
						{
							market_status = json.marketDefinition.status;
						}
						if (json.marketDefinition.hasOwnProperty("marketTime"))
						{
							market_start = json.marketDefinition.marketTime;
						}
						if (json.marketDefinition.hasOwnProperty("venue"))
						{
							venue = json.marketDefinition.venue;
						}
						if (json.marketDefinition.hasOwnProperty("countryCode"))
						{
							country = json.marketDefinition.countryCode;
						}
						if (json.marketDefinition.hasOwnProperty("eventTypeId"))
						{
							 event_type_id = json.marketDefinition.eventTypeId;
						}						
					}								
				}
				else
				{
					// file invalid
					console.log("File " + value + " contains invalid data and will be ignored.");
					break;
				}								
			}
		}
		if (market_status === "CLOSED")
		{
			if (market_id.length > 0 && market_start.length > 0 && country.length > 0)
			{
				// Parse market start time
				//"2022-03-31T12:00:00.000Z"
				market_start = market_start.replace(/-/g, '');	
				var date_path = market_start.substr(0,8);
				let destination_path = event_type_id + '/' + date_path + '/' + country + '/'
				if (venue.length > 0)
				{
					// Strip whitespace from venue
					venue = venue.replace(/ /g, '');
					destination_path += (venue + '/');
				}
				let basepath = config.priceStreamLoggingBase;
				if (basepath.slice(basepath.length - 1) === '/')
				{
					basepath = basepath.slice(0, -1); 					
				}
				const outpath = basepath + '/' + destination_path;
				let outfile = outpath + market_id + '.pricestreamlog';				
				if (fs.existsSync(outfile))
				{
					console.log("File " + value + " has not been processed (destination file already exists)");
				}
				else
				{					
					if (fs.existsSync(outpath) === false)
					{
						fs.mkdirSync(outpath, { recursive: true });
					}
					if (fs.existsSync(outpath))
					{
						fs.renameSync(value,outfile);
					}
					else
					{
						console.log("Error - unable to create destination directory " + outpath);
					}
				}
			}
			else
			{
				console.log("File " + value + " does not appear to be a market stream recording file.");
			}		
		}
	}
	else
	{
		console.log("File " + value + " does not exist!");
	}
}

//============================================================ 
function run()
{
	var comm_params = process.argv.slice(2); 
    if (comm_params.length != 1)
    {
		console.log("Error - insufficient arguments supplied. Required arguments are:");
		console.log("[1] - Target directory where input files reside.");				
		process.exit(1);
	}
	const target_dir = comm_params[0];
	let files = [];
	try {
		
		files = fs.readdirSync(target_dir);				
		const text_files = files.filter(function (file) {
			return path.extname(file) === ".txt";
		});

			
		// Attempt to parse files and see if they are stream record files
		console.log(text_files);
		const num_files = text_files.length;
		for (let i = 0; i < num_files; ++i)
		{			
			let filename = target_dir + '/' + text_files[i];
			processFile(filename)			
		}

	} catch (err) {
		console.log(err);
		process.exit(1);
	}
}



