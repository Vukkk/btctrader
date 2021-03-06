"use strict";

const binance = require('../../src/market/binance/index');

const fs = require('fs');

const SIMTRADE = true;

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

binance.DataMgr.singleton.init(cfg).then(() => {
    var ds = new binance.DataStream({
        output_message: false,
        simtrade: SIMTRADE,
        tickdatatname: 'binance_eosbtc',
        candledatatname: 'binance_kl_eosbtc',
        symbol: 'eosbtc'
    });

    ds.mgrData = binance.DataMgr.singleton;
    ds.init();
});