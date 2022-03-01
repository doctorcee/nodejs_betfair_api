#!/usr/bin node
"use strict";

var fs = require('fs');

module.exports = {
	
	timestampedLogMessageSync: function (filename, message) {
		let ts = new Date();		
		let tsstring = ts.toJSON() + "| ";
		fs.appendFileSync(filename, tsstring + message + "\n", function (err) {
			if (err) 
			{
				console.log(err);
			}
		});	
	},
	
	logMessage: function (filename, message,console_print) {
		let ts = new Date();		
		let msg = ts.toJSON() + "| " + message;
		if (console_print) {
			console.log(msg);
		}
		fs.appendFile(filename, msg + "\n", function (err) {
			if (err) 
			{
				console.log(err);
			}
		});
	}
}
