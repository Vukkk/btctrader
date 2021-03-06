"use strict";

const bithumb = require('../../src/market/bithumb/index');

const fs = require('fs');

const SIMTRADE = true;

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

bithumb.DataMgr.singleton.init(cfg).then(() => {
    var ds = new bithumb.DataStream({
        output_message: false,
        simtrade: SIMTRADE,
        tickdatatname: 'bithumb_bch',
        candledatatname: 'bithumb_kl_bch',
        symbol: 'bch'
    });

    ds.mgrData = bithumb.DataMgr.singleton;
    ds.init();
});