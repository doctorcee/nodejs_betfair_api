#!/usr/bin node
"use strict";

module.exports = {
	
	getHRTimeUsecs: function () {
		var hrTime = process.hrtime();
		return ('[' + hrTime[0] + '.' + Math.floor(hrTime[1]/1000000) + ']  ');
	},
	
	getHRMicrosecsNow: function () {
		return process.hrtime();		
	},
	
	getElapsedTimeFrom: function (old_time) {
		var hrTime = process.hrtime(old_time);
		return (hrTime[0] + hrTime[1]/1000000000.0);		
	},
	
	secondsUntil: function (now, then) {
		return then.diff(now, 'seconds');
	},
	
	dateToStringYMD: function (date_object) {
		// Input parameter:
        // 		Javascript Date object
        // Return value: 
		// 		YYYYMMDD formatted string
		
		let date_string = ""
		date_string += date_object.getUTCFullYear();
		
		let month = date_object.getUTCMonth() + 1;
		if (month < 10)
		{
			date_string += ('0' + month);
		}
		else
		{
			date_string += month;
		}
		
		let day = date_object.getUTCDate();	
		if (day < 10)
		{
			date_string += ('0' + day);
		}
		else
		{
			date_string += day;
		}
		
		
		return date_string;
	},
	
	timeStringUTC: function (date_object) {
		// Input parameter:
        // 		Javascript Date object
        // Return value: 
		// 		UTC based hh:mm formatted time string
		
		let time_string = '';
		let hour = date_object.getUTCHours();
		if (hour < 10)
		{
			time_string += ('0' + hour + ':');
		}
		else
		{
			time_string += (hour + ':');
		}
		let min = date_object.getUTCMinutes();
		if (min < 10)
		{
			time_string += ('0' + min);
		}
		else
		{
			time_string += min;
		}
		return time_string;
	},
	
	todaysDateAsString: function () {
		// Input parameter:
        // 		none
        // Return value: 
		// 		YYYY-MM-DD formatted string for TODAY'S date
		
		let today = new Date();   
		let year_string = today.getFullYear();
		let month_string = today.getMonth() + 1;
		let day_string = today.getDate();
		let date_string = year_string + '-';
		if (month_string < 10)
		{
			date_string += ('0' + month_string + '-');
		}
		else
		{
			date_string += (month_string + '-');
		}
		if (day_string < 10)
		{
			date_string += ('0' + day_string);
		}
		else
		{
			date_string += day_string;
		}
		return date_string;
	}
}
