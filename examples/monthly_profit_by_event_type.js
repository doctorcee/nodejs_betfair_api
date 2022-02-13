#!/usr/bin node
//------------------------------------------------------
// IMPORTANT - PLEASE READ THE LICENSE TERMS BEFORE 
// DECIDING IF YOU WANT TO USE THIS CODE
//------------------------------------------------------
// Description
// Simple script that will log into your Betfair account
// (using the login parameters stored in the config.js
// file - see login.hs for details) and request profits 
// at the market level for a specified month and event type.
//------------------------------------------------------

"use strict"

const config = require('../config.js');
var bfapi = require('../api_ng/betfairapi.js');
var market_filters = require('../api_ng/market_filters.js');

run();

