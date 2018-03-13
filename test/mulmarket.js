"use strict";

const binance = require('../src/market/binance/index');
const huobi = require('../src/market/huobi/index');
const okcoinex = require('../src/market/okcoinex/index');
const bitfinex = require('../src/market/bitfinex/index');

const { Trader } = require('../src/trader');
const { Strategy_MulMarket } = require('../src/strategy/mulmarket');
const BTCTraderMgr = require('../src/btctradermgr');
const fs = require('fs');

const SIMTRADE = true;

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

BTCTraderMgr.singleton.init(cfg).then(() => {
    var ds0 = new bitfinex.DataStream({
        // addr: 'wss://real.okcoin.com:10440/websocket',
        // symbol: 'btc_usd',
        // addr: 'wss://real.okex.com:10441/websocket',
        symbol: 'EOSUSD',
        output_message: false,
        simtrade: SIMTRADE
    });

    // var ds0 = new okcoinex.DataStream({
    //     // addr: 'wss://real.okcoin.com:10440/websocket',
    //     // symbol: 'btc_usd',
    //     addr: 'wss://real.okex.com:10441/websocket',
    //     symbol: 'btc_usdt',
    //     output_message: false,
    //     simtrade: SIMTRADE
    // });

    // var ds0 = new huobi.DataStream({
    //     addr: 'wss://api.huobi.pro/ws',
    //     symbol: 'ethusdt',
    //     simtrade: SIMTRADE
    // });

    // var ds1 = new binance.DataStream({
    //     addr: 'wss://stream.binance.com:9443/ws',
    //     symbol: 'eosusdt',
    //     timeout_keepalive: 30 * 1000,
    //     timeout_connect: 30 * 1000,
    //     timeout_message: 30 * 1000,
    //     output_message: false,
    //     simtrade: SIMTRADE,
    // });

    var ds1 = new okcoinex.DataStream({
        // addr: 'wss://real.okcoin.com:10440/websocket',
        // symbol: 'btc_usd',
        addr: 'wss://real.okex.com:10441/websocket',
        symbol: 'eos_usdt',
        output_message: false,
        simtrade: SIMTRADE
    });

    var trader = new Trader();
    trader.setStrategy(new Strategy_MulMarket());
    trader.addMarket('bitfinex', 0, 0, 10000, ds0);
    trader.addMarket('binance', 0, 0, 10000, ds1);

    ds0.init();
    ds1.init();
});