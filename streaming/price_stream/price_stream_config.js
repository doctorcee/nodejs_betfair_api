let config = {
  priceStreamEndpoint : 'stream-api.betfair.com',  
  priceStreamMonitorRate : 500,
  priceStreamHeartbeat : 2000,
  priceLadderLevels : 10,  
  marketTypeArray : ["WIN","PLACE"],
  countryCodeArray : ["GB","US","IE"],
  eventTypeIDArray : ["7"],
  streamFieldsArray : ["EX_ALL_OFFERS","EX_TRADED","EX_TRADED_VOL","EX_LTP","EX_MARKET_DEF","EX_BEST_OFFERS_DISP","SP_PROJECTED"]
};

module.exports = config;
