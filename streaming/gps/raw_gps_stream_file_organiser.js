#!/usr/bin node

// Description:
// Parse gps stream files  - create date from epoch timestamps.
// Rewrite file under a date based folder hierarchy
// At a later date we can extract venues from DB and use same folder
// structure as the market price stream data files
//------------------------------------------------------

"use strict"
var fs = require('fs')
const path = require("path")
const config = require('../../config.js')
var date_utils = require('../../utils/date_utilities.js')

run();

//============================================================ 
function processFile(value) 
{
	if (fs.existsSync(value))
	{		
		let market_id = ""
		let market_start = ""
		let market_status = ""
		let venue = ""
		let country = "";
		let event_type_id = "0"
		var filebuf = fs.readFileSync(value, "utf8")
		var line_array = filebuf.split("\n")
		const num_lines = line_array.length		
		let ts = 0
		
		for (var i = 0; i < num_lines; i++) 
		{	
			const this_line = line_array[i]			
			if (this_line.length > 0)
			{	
				let linesplit = this_line.split('|')
				if (linesplit.length === 3)
				{
					ts = parseInt(linesplit[1])										
					try
					{
						let json = JSON.parse(linesplit[2])
						if (json.hasOwnProperty("mid"))
						{
							market_id = json.mid			
						}
					}
					catch (ex)
					{
						console.log(filedata)
						console.log("ERROR: JSON parsing error " + "[" + ex.message + "]")
						console.log("File " + value + " contains invalid data and will be ignored.")
						break
					}
																
				}
				else
				{
					// file invalid
					console.log("File " + value + " contains invalid data and will be ignored.")
					break
				}								
			}
			if (ts > 0 && market_id !== "")
			{				
				break
			}
		}
		if (ts === 0 || market_id === "")
		{
			console.log("File " + value + " does NOT contain a valid date and market ID.");		
		}
		else
		{
			let tsdate = new Date(ts)			
			let destination_path =  tsdate.getFullYear() + '/' + date_utils.dateToStringYMD(tsdate) + '/'
				
			let basepath = config.processedGPSFilesDestinationDirectory
			if (basepath.slice(basepath.length - 1) === '/')
			{
				basepath = basepath.slice(0, -1)		
			}
			const outpath = basepath + '/' + destination_path
			let outfile = outpath + market_id + '.gpsstreamlog'
			if (fs.existsSync(outfile))
			{
				console.log("File " + value + " has not been processed (destination file already exists)")
			}
			else
			{					
				if (fs.existsSync(outpath) === false)
				{
					fs.mkdirSync(outpath, { recursive: true })
				}
				if (fs.existsSync(outpath))
				{
					fs.renameSync(value,outfile)
				}
				else
				{
					console.log("Error - unable to create destination directory " + outpath)
				}
			}
		}			
	}
	else
	{
		console.log("File " + value + " does not exist!")
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
	try 
	{		
		files = fs.readdirSync(target_dir);				
		const text_files = files.filter(function (file) {
			return path.extname(file) === ".txt"
		});
			
		// Attempt to parse files and see if they are stream record files
		console.log(text_files);
		const num_files = text_files.length;
		for (let i = 0; i < num_files; ++i)
		{			
			let filename = target_dir + '/' + text_files[i];
			processFile(filename)			
		}

	} 
	catch (err) 
	{
		console.log(err);
		process.exit(1);
	}
}



