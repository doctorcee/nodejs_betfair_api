#!/usr/bin node

/* 
 * IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
 * DECIDING IF YOU WISH TO MAKE USE OF THIS CODE
 * 
 * Description
 * Module file with functions that invoke Betfair API operations
*/ 

"use strict";

// import required packages
var fs = require('fs');
var url = require('url'); 
var https = require('https'); 

module.exports = {
    
    validateAPIResponse: function(response) {
        // Input parameter:
        // 1. response - an object that is the return value of JSON.parse() 
        //    called on an API response buffer
        // Return value: boolean flag indicating if there are errors with the response
        
        // If there was an error, we should get a betfair APINGException returned
        let success = true;
        if (response.error != null) 
        {
            success = false;
            // if error in response contains only two fields it means that there is no 
            // detailed message of exception thrown from API-NG          
            console.log("Error with request!!");
            console.log("Error code: " + response.error.code);
            console.log("Message: " + response.error.message);
            if (Object.keys(response.error).length > 2) 
            {
                console.error("Exception Details: ");
                console.error(JSON.stringify(response.error.data.APINGException, null, "\t"));
            }
        }
        return success;
    },
    login : function(login_params,callback) {
        // Input parameters: 
        // 1. login_params - must contain the following data:
        //    a. login_params.kp - string containing full path to key file
        //    b. login_params.cp - string containing full path to cert file
        //    c. login_params.ak - string storing the application key
        //    d. login_params.un - string storing account username
        //    e. login_params.pw - string storing account password
        // 2. callback - callback function that accepts an object that contains
        //    the following data:
        //    a. response_status_code - integer HTTP status code.
        //    b. login_status - string containing the loginStatus string returned by API response
        //    c. session_id - string containing the session token value returned by API response
        //    d. error - boolean flag indicating presence of error in response (or request)
        //    e. error_message - string containing error details (or "OK" if no error)        
       
        // Create the callback function parameter object that will be passed to callback 
        // when we invoke it. This occurs on receipt of API login response, or an error.
        let callback_params = {};
        callback_params.response_status_code = 0;
        callback_params.login_status = 'ERROR';
        callback_params.session_id = '';
        callback_params.error = true;
        callback_params.error_message = '';        
        
        // Create URL object from the logon endpoint using the URL package
        // See this link:  https://nodejs.org/api/url.html#url_url 
        // for more details.
        const login_endpoint = "https://identitysso-cert.betfair.com/api/certlogin";
        let login_options = url.parse(login_endpoint);

        // We login with a HTTP POST request.
        // Set the header and options - including application key and the 
        // key file and cert file
        login_options.method = 'POST';
        login_options.port = 443;

        // Set the application key within the headers according to betfair documentation
        login_options.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Application': login_params.ak
        };
        login_options.key = fs.readFileSync(login_params.kp);
        login_options.cert = fs.readFileSync(login_params.cp);
        login_options.agent = new https.Agent(login_options);

        // Create a new https request object.
        let req = https.request(login_options, function(res) {                                
            // Create string to store the API response data
            let responseData = "";
            res.on('data', function(new_data) {
                // New data arrived - append to existing string buffer
                responseData += new_data;
            });
            res.on('end', function() {
                // On end handler. Fires when the response has been fully received
                try
                {
                    // Parse the response JSON
                    let response = JSON.parse(responseData);
                    const login_status = response.loginStatus;
                    const response_code = res.statusCode;
                    callback_params.login_status = login_status;
                    callback_params.response_status_code = response_code; 
                    if (200 === response_code)
                    {
                        // Received HTTP status code 200. 
                        // The response is a JSON object that contains a status
                        // code. If login was successful, it also includes a session token.                    
                        // See Betfair documentation on the non-interactive login for more
                        // details
                        if ("SUCCESS" === response.loginStatus)
                        {
                            // Successful logon!!                                    
                            // Store the session token. In this script we don't do anything with 
                            // it but in a full application this must be sent with every 
                            // API request we make to identify our session.
                            callback_params.session_id = response.sessionToken;
                            callback_params.error = false;
                            callback(callback_params);                                              
                        }                    
                        else
                        {
                            callback_params.error_message = ("Login Failure. Reason: API loginStatus = " + login_status);
                            callback(callback_params);    
                        }    
                    }        
                    else
                    {
                        callback_params.error.message = ("Login Failure. Reason: HTTP response error code " + response_code);
                        callback(callback_params);    
                    }            
                }
                catch (e)
                {
                    // JSON parser error - report the reason that the JSON was not
                    // correctly parsed.
                    callback_params.error_message = ("Login Failure. Reason: Exception caught (" + e.message + ")");
                    callback(callback_params);    
                }
            });
            res.on('error', function(e) {
                // Error with response 
                callback_params.error_message = ("Login Failure. Reason: HTTPS response error (" + e.message + ")");                
                callback(callback_params);    
            });
        });

        // Create string that forms our request payload - this contains our login credentials
        let data = 'username=' + login_params.un + '&password=' + login_params.pw;

        // Post the request
        req.end(data);
        req.on('error', function(e) {
            // Error with the request
            callback_params.error_message = ("Login Failure. Reason: HTTPS request error (" + e.message + ")");            
            callback(callback_params);    
        });
    }
}
