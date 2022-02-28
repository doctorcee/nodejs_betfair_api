#!/usr/bin node
"use strict";

var fs = require('fs');

module.exports = {
	
	writeStringToFileSync: function (filename, data) {
		fs.writeFileSync(filename,data, function(err) {
			if (err)
			{
				console.log(err);
			}
		});
	},
	appendStringToFile: function (filename,data) {
		fs.appendFile(filename,data+"\n", function (err) {
			if (err) 
			{
				console.log(err);
			}
		});
	},
	appendStringToFileSync: function (filename,data) {
		fs.appendFileSync(filename,data, function (err) {
			if (err) 
			{
				console.log(err);
			}
		});
	}
}
