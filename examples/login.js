#!/usr/bin node
"use strict"
 //------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// using the login parameters stored in the config.js
// file which will need to be created and have the form:
// 
//	let config = {
//		un : 'your_account_username',
//		pw : 'your_account_password',
//		cp : 'path_to_certificate_file',
//		kp : 'path_to_key_file',
//  	ak : 'your_account_app_key'
//	};
//	module.exports = config;
//
//

const config = require('../config.js');
var bfapi = require('../api_ng/betfairapi.js');

run();

//============================================================ 
function run() 
{
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
        console.log("Success!");    
        console.log("Logged in as " + config.un);
        console.log("Session token: " + login_response_params.session_id);
    }
    else
    {
        console.log(login_response_params.error_message);
    }                                                                                                                    
}



