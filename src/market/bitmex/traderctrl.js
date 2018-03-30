"use strict";

const { TraderCtrl } = require('../../traderctrl');
const { ORDERSIDE, ORDERTYPE, ORDERSTATE } = require('../../basedef');
const OrderMgr = require('../../ordermgr');
const request = require('request');
const crypto = require('crypto');

class BitmexTraderCtrl extends TraderCtrl {
    // cfg.baseuri
    // cfg.baseapiuri
    // cfg.apikey
    // cfg.apisecret
    // cfg.symbol
    constructor(cfg) {
        super(cfg);
    }

    _procConfig() {
        super._procConfig();

        if (!this.cfg.baseuri) {
            this.cfg.baseuri = 'https://testnet.bitmex.com';
        }

        if (!this.cfg.baseapipath) {
            this.cfg.baseapipath = '/api/v1/';
        }
    }

    _makeSignature(verb, cmd, expires, strparams) {
        let s = crypto.createHmac('sha256', this.cfg.apisecret).update(verb + (this.cfg.baseapipath + cmd) + expires + strparams).digest('hex');
        return s;
    }

    request(verb, cmd, params, callback) {
        let expires = new Date().getTime() + (60 * 1000);
        let strparams = JSON.stringify(params);

        let headers = {
            'content-type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': this.cfg.apikey,
            'api-signature': this._makeSignature(verb, cmd, expires, strparams)
        };

        let ro = {
            headers: headers,
            url: this.cfg.baseuri + this.cfg.baseapipath + cmd,
            method: verb,
            body: strparams
        };

        request(ro, (err, res, body) => {
            if (err) {
                this.log('error', JSON.stringify(err));
            }

            this.log('log', JSON.stringify(body));
            // let msg = JSON.parse(body);

            if (callback) {
                callback(err, res, body);
            }
        });
    }

    requestPromise(verb, cmd, params) {
        let expires = new Date().getTime() + (60 * 1000);
        let strparams = JSON.stringify(params);

        let headers = {
            'content-type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': this.cfg.apikey,
            'api-signature': this._makeSignature(verb, cmd, expires, strparams)
        };

        let ro = {
            headers: headers,
            url: this.cfg.baseuri + this.cfg.baseapipath + cmd,
            method: verb,
            body: strparams
        };

        return new Promise((resolve, reject) => {
            request(ro, (err, res, body) => {
                resolve({ err, res, body });
            });
        });
    }

    async getAllOrderList() {
        let lst = [];
        let count = 100;
        let start = 0;

        while (true) {
            let { err, res, body } = await this.requestPromise('GET', 'order', {symbol: this.symbol, start: start, count: count});
            if (err) {
                return lst;
            }

            let msg = JSON.parse(body);

            for (let i = 0; i < msg.length; ++i) {
                let co = msg[i];

                lst.push({
                    id: co.orderID,
                    symbol: co.symbol,
                    side: co.side == 'Buy' ? ORDERSIDE.BUY : ORDERSIDE.SELL,
                    openms: new Date(co.timestamp).getTime(),
                    closems: new Date(co.transactTime).getTime(),
                    type: co.ordType == 'Limit' ? ORDERTYPE.LIMIT : ORDERTYPE.MARKET,
                    price: co.price,
                    volume: co.orderQty,
                    avgprice: co.avgPx,
                    lastvolume: co.leavesQty,
                });
            }

            start += count;

            if (msg.length < count) {
                return lst;
            }
        }

        return lst;
    }

    async getOpenOrderList() {
        let lst = [];
        let count = 100;
        let start = 0;

        while (true) {
            let { err, res, body } = await this.requestPromise('GET', 'order', {symbol: this.cfg.symbol, open: true, start: start, count: count});
            if (err) {
                return lst;
            }

            let msg = JSON.parse(body);
            if (msg.length < count) {
                return lst;
            }

            for (let i = 0; i < msg.length; ++i) {
                let co = msg[i];

                lst.push({
                    id: co.orderID,
                    symbol: co.symbol,
                    side: co.side == 'Buy' ? ORDERSIDE.BUY : ORDERSIDE.SELL,
                    openms: new Date(co.timestamp).getTime(),
                    closems: new Date(co.transactTime).getTime(),
                    type: co.ordType == 'Limit' ? ORDERTYPE.LIMIT : ORDERTYPE.MARKET,
                    price: co.price,
                    volume: co.orderQty,
                    avgprice: co.avgPx,
                    lastvolume: co.leavesQty,
                });
            }

            start += count;
        }

        return lst;
    }

    _formatPrice(side, p) {
        let fp = p.toFixed(1);
        let arr = fp.split('.');
        if (arr.length == 2) {
            if (arr[1] == '0' || arr[1] == '5') {
                return parseFloat(fp);
            }

            if (side == ORDERSIDE.BUY) {
                if (arr[1] > 5) {
                    return parseFloat(arr[0] + '.5');
                }

                return parseFloat(arr[0] + '.0');
            }
            else {
                if (arr[1] > 5) {
                    return parseFloat((parseInt(arr[0]) + 1).toString() + '.0');
                }

                return parseFloat(arr[0] + '.5');
            }
        }

        return parseFloat(fp);
    }

    newLimitOrder(order, callback) {
        this.request('POST', 'order', {
            symbol: order.symbol,
            ordType: 'Limit',
            orderQty: order.volume,
            price: this._formatPrice(order.side, order.price),
            side: order.side == ORDERSIDE.BUY ? 'Buy' : 'Sell',
            clOrdID: order.mainid + '-' + order.indexid,
        }, (err, res, body) => {
            if (callback) {
                callback(order);
            }
        });
    }

    newMarketOrder(order, callback) {
        this.request('POST', 'order', {
            symbol: order.symbol,
            ordType: 'Market',
            orderQty: order.volume,
            side: order.side == ORDERSIDE.BUY ? 'Buy' : 'Sell',
            clOrdID: order.mainid + '-' + order.indexid,
        }, (err, res, body) => {
            if (callback) {
                callback(order);
            }
        });
    }

    newOCOOrder(order, callback) {
        let spo = order.lstchild[0];
        let slo = order.lstchild[1];
        let lstorders = [];

        lstorders.push({
            symbol: spo.symbol,
            ordType: 'Limit',
            orderQty: spo.volume,
            price: this._formatPrice(order.side, spo.price),
            side: spo.side == ORDERSIDE.BUY ? 'Buy' : 'Sell',
            contingencyType: 'OneCancelsTheOther',
            clOrdLinkID: slo.mainid + '-' + slo.indexid,
            clOrdID: spo.mainid + '-' + spo.indexid,
        });

        if (slo.side == ORDERSIDE.BUY) {
            lstorders.push({
                symbol: slo.symbol,
                ordType: 'StopLimit',
                orderQty: slo.volume,
                price: this._formatPrice(order.side, slo.price),
                stopPx: this._formatPrice(order.side, slo.price) - 0.5,
                side: 'Buy',
                contingencyType: 'OneCancelsTheOther',
                clOrdLinkID: spo.mainid + '-' + spo.indexid,
                clOrdID: slo.mainid + '-' + slo.indexid,
            });
        }
        else {
            lstorders.push({
                symbol: slo.symbol,
                ordType: 'StopLimit',
                orderQty: slo.volume,
                price: this._formatPrice(order.side, slo.price),
                stopPx: this._formatPrice(order.side, slo.price) + 0.5,
                side: 'Sell',
                contingencyType: 'OneCancelsTheOther',
                clOrdLinkID: spo.mainid + '-' + spo.indexid,
                clOrdID: slo.mainid + '-' + slo.indexid,
            });
        }

        this.request('POST', 'order/bulk', {
            orders: lstorders,
        }, (err, res, body) => {
            if (callback) {
                callback(order);
            }
        });
    }

};

exports.BitmexTraderCtrl = BitmexTraderCtrl;