#!/usr/bin node

//------------------------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------------------------
// Description
// Module file with functions that invoke Betfair API operations
//------------------------------------------------------------------------

"use strict";

// import required packages
var fs = require('fs');
var url = require('url'); 
var https = require('https'); 
var zlib = require('zlib');

const DEFAULT_ENCODING = 'utf-8';

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
        // 2. callback - callback function which gets passed an object with 
        //    the following items:
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
    },

    keepAlive : function(session_id,app_key,callback) {
        // Input parameters:
        // 1. session ID 	- current session ID
        // 2. app key    	- account application key
        // 3. callback 		- callback function which gets passed an object with
        //    the following items:
        //    a. Session token
        //	  b. Status
        //    c. Error_message

        // Create the callback function parameter object that will be passed to callback 
        // when we invoke it. This occurs on receipt of API login response, or an error.
        let callback_params = {};
        callback_params.status = '';
        callback_params.token = '';
        callback_params.error = true;
        callback_params.error_message = '';

        // Create URL object from the logon endpoint using the URL package
        // See this link:  https://nodejs.org/api/url.html#url_url 
        // for more details.
        const ka_endpoint = 'https://identitysso.betfair.com/api/keepAlive';//"https://identitysso-cert.betfair.com/api/keepAlive";
        let options = url.parse(ka_endpoint);

        // Set the header and options - including application key and the 
        // key file and cert file
        options.method = 'POST';
        options.port = 443;

        // Set the application key and session token within the headers according to betfair documentation
        options.headers = {
			'Accept': 'application/json',
			'X-Authentication' : session_id,
			'X-Application': app_key
        };

        // Create a new https request object.
        let req = https.request(options, function(res) {
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
                    const status = response.status;
                    const response_code = res.statusCode;
                    callback_params.status = response.status;
                    if (callback_params.status === "SUCCESS")
                    {
						callback_params.error = false;
					}
                    callback_params.token = response.token;
                    callback_params.error_message = response.error;
                    callback(callback_params); 
                }
                catch (e)
                {
                    // JSON parser error - report the reason that the JSON was not
                    // correctly parsed.
                    callback_params.error_message = ("KA JSON parse failed. Reason: Exception caught (" + e.message + ")");
                    callback(callback_params);    
                }
            });
            res.on('error', function(e) {
                // Error with response 
                callback_params.error_message = ("KA Failure. Reason: HTTPS response error (" + e.message + ")");                
                callback(callback_params);    
            });
        });

        req.on('error', function(e) {
            // Error with the request
            callback_params.error_message = ("KA Failure. Reason: HTTPS request error (" + e.message + ")");            
            callback(callback_params);    
        });     
        // post the request   
        req.end();
        console.log("Keep alive called.");
    },
    
    sendRequest : function(operation_name,session_id,app_key,filter,use_gzip_compression,callback)
    {
		let https_options = {
            hostname: 'api.betfair.com',
            port: 443,
            path: '/exchange/betting/json-rpc/v1',
            agent: new https.Agent(),
            method: 'POST',
            headers: {            
                'Accept': 'application/json',
                'Content-type' : 'application/json',
                'X-Authentication' : session_id,
                'Connection':'Keep-Alive',
                'X-Application' : app_key,
            }
        }
        if (use_gzip_compression === true)
        {
			https_options.headers['Accept-Encoding'] = 'gzip';
        }
        
        let response_params = {};
        response_params.error = true;
        response_params.error_message = 'ERROR';
        response_params.data = '';
        response_params.session_id = session_id;        
        
        let json_request = '{"jsonrpc":"2.0","method":"SportsAPING/v1.0/' + operation_name + '", "params": ' + filter + ', "id": 1}';
        
        // Create a string buffer to store the response we get back
        let response_buffer = '';
        
        // Create the HTTPS request now
        let req = https.request(https_options,function (res) {
			if (res.headers['content-encoding'] === 'gzip')
			{
				// Result is compressed
				var gunzip = zlib.createGunzip();
				gunzip.on('data', function(data) {
					response_buffer += data.toString();
				});
				gunzip.on('end', function(){
					response_params.data = response_buffer;
					response_params.error = false;
					response_params.error_message = "OK";
					callback(response_params);
				});
				res.pipe(gunzip);
			}
			else
			{
				res.setEncoding(DEFAULT_ENCODING);
				res.on('data', function (chunk) {
					// Event handler for arrival of new data
					// Append the new data to the buffer
					response_buffer += chunk;
				});
				res.on('end', function() {
					// Event handler for end of data received.
					// When the transmission has ended we call the response
					// parser function
					response_params.data = response_buffer;
					response_params.error = false;
					response_params.error_message = "OK";
					callback(response_params);
				});
			}
			res.on('close', function(err) {
				// Socket close error handler                
                response_params.error_message = 'ERROR SOCKET CONNECTION CLOSED!';
                response_params.data = '';
               callback(response_params);
			});			 
        });
            
        // Send Json request object
        req.write(json_request, DEFAULT_ENCODING);
        req.end();
        req.on('error', function(e) {
            // error handler for request            
            response_params.error_message = 'REQUEST ERROR: ' + e.message;
            response_params.data = '';
            callback(response_params);
        });    
	},
    
    listMarketCatalogue : function(session_id,app_key,filter,compress,callback) {
        // Input parameter params:
        // 1. Valid sesssion token
        // 2. Valid application key
        // 3. Market filter to apply to this request
        // 4. Flag to indicate whether to request response is gzip compressed or not.
        // 5. Callback function that accepts object that must contain the following objects:
        //    a. error - a boolean error flag
        //    b. error_message - string containing error details or "OK" when no error
        //    c. data - string containing the JSON response
        //    d. session_id - string duplicated from the input session token value        
        
        module.exports.sendRequest("listMarketCatalogue",session_id,app_key,filter,compress,callback)
    },
    
    listClearedOrders : function(session_id,app_key,filter,compress,callback) 
    {
        // Input parameter params:
        // 1. Valid sesssion token
        // 2. Valid application key
        // 3. Market filter to apply to this request
        // 4. Flag to indicate whether to request response is gzip compressed or not.
        // 5. Callback function that accepts object that must contain the following objects:
        //    a. error - a boolean error flag
        //    b. error_message - string containing error details or "OK" when no error
        //    c. data - string containing the JSON response
        //    d. session_id - string duplicated from the input session token value        
        
        module.exports.sendRequest("listClearedOrders",session_id,app_key,filter,compress,callback)        
    },
    
    listEventTypes : function(session_id,app_key,filter,compress,callback) 
    {
        // Input parameter params:
        // 1. Valid sesssion token
        // 2. Valid application key
        // 3. Market filter to apply to this request
        // 4. Flag to indicate whether to request response is gzip compressed or not.
        // 5. Callback function that accepts object that must contain the following objects:
        //    a. error - a boolean error flag
        //    b. error_message - string containing error details or "OK" when no error
        //    c. data - string containing the JSON response
        //    d. session_id - string duplicated from the input session token value        
        
        module.exports.sendRequest("listEventTypes",session_id,app_key,filter,compress,callback)        
    },
    
    listEvents : function(session_id,app_key,filter,compress,callback) 
    {
        // Input parameter params:
        // 1. Valid sesssion token
        // 2. Valid application key
        // 3. Market filter to apply to this request
        // 4. Flag to indicate whether to request response is gzip compressed or not.
        // 5. Callback function that accepts object that must contain the following objects:
        //    a. error - a boolean error flag
        //    b. error_message - string containing error details or "OK" when no error
        //    c. data - string containing the JSON response
        //    d. session_id - string duplicated from the input session token value   
        
        
        
        module.exports.sendRequest("listEvents",session_id,app_key,filter,compress,callback)        
    },
    
    listCompetitions : function(session_id,app_key,filter,compress,callback) 
    {
        // Input parameter params:
        // 1. Valid sesssion token
        // 2. Valid application key
        // 3. Market filter to apply to this request
        // 4. Flag to indicate whether to request response is gzip compressed or not.
        // 5. Callback function that accepts object that must contain the following objects:
        //    a. error - a boolean error flag
        //    b. error_message - string containing error details or "OK" when no error
        //    c. data - string containing the JSON response
        //    d. session_id - string duplicated from the input session token value        
        
        module.exports.sendRequest("listCompetitions",session_id,app_key,filter,compress,callback)        
    }      
    
    
}
