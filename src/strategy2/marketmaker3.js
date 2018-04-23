"use strict";

const util = require('util');
const { Strategy2 } = require('../strategy2');
// const { DEPTHINDEX, DEALSINDEX, DEALTYPE } = require('../datastream');
const { DEPTHINDEX, DEALSINDEX, DEALTYPE, STRATEGYSTATE, ORDERSTATE } = require('../basedef');
const { countPriceWithDepth_asks_depth2, countPriceWithDepth_bids_depth2 } = require('../util');
const { countOrderList } = require('../order');
const OrderMgr = require('../ordermgr');
const { ORDERSIDE } = require('../basedef');
const IndicatyorMgr = require('../indicator/indicatormgr');
const { INDICATOR_RSI, INDICATOR_COUPLING } = require('../indicator/indicatordef');

class TimePrice {
    constructor(nums, timeoff) {
        this.timeoff = timeoff;

        this.tms_to = [];
        this.price = [];
        this.avgprice = [];

        for (let i = 0; i < nums; ++i) {
            this.tms_to.push(0);
            this.price.push(0);
            this.avgprice.push(0);
        }
    }

    _onNewTimeOff() {
        let len = this.tms_to.length;
        for (let i = 0; i < len - 1; ++i) {
            this.tms_to[len - 1 - i] = this.tms_to[len - i - 2];
            this.price[len - 1 - i] = this.price[len - i - 2];
            this.avgprice[len - 1 - i] = this.avgprice[len - i - 2];
        }
    }

    setPrice(tms, price) {
        let tms_to = Math.floor(tms / this.timeoff);
        if (this.tms_to[0] == 0) {
            this.tms_to[0] = tms_to;
            this.price[0] = price;
            this.avgprice[0] = price;

            return ;
        }

        if (tms_to > this.tms_to[0]) {
            this._onNewTimeOff();

            this.tms_to[0] = tms_to;
            this.price[0] = price;
            this.avgprice[0] = price;

            return ;
        }

        this.price[0] = price;
        this.avgprice[0] = (this.price[0] + price) / 2;
    }

    trend() {
        let ct = 0;
        let len = this.tms_to.length;
        for (let i = 0; i < len - 1; ++i) {
            if (this.price[i] == 0) {
                return 0;
            }

            let cct = this.price[i] - this.price[i + 1];
            if (ct == 0) {
                ct = cct;
            }
            else {
                if (ct <= 0 && cct > 0) {
                    return 0;
                }

                if (ct >= 0 && cct < 0) {
                    return 0;
                }
            }
        }

        return ct;
    }

    isDataInited() {
        let len = this.tms_to.length;
        for (let i = 0; i < len; ++i) {
            if (this.tms_to[i] == 0) {
                return false;
            }
        }

        return true;
    }

    trendex(dest) {
        let ct = 0;
        let len = this.tms_to.length;
        for (let i = 0; i < len; ++i) {
            let cct = this.avgprice[i] - dest.avgprice[i];
            if (ct == 0) {
                ct = cct;
            }
            else {
                if (ct <= 0 && cct > 0) {
                    return 0;
                }

                if (ct >= 0 && cct < 0) {
                    return 0;
                }
            }
        }

        return ct;
    }
};

class Strategy2_MarketMaker3 extends Strategy2 {
    constructor() {
        super();

        this.rsi = [
            IndicatyorMgr.singleton.newIndicator(INDICATOR_RSI, 60 * 1000, 14),
            IndicatyorMgr.singleton.newIndicator(INDICATOR_RSI, 60 * 1000, 14)
        ];

        this.coupling = IndicatyorMgr.singleton.newIndicator(INDICATOR_COUPLING, 60 * 1000, 1);

        this.marketPrice = [0, 0];

        this.volume = 0;
        this.price = 0;

        this.destPrice = 0;
        this.side = 0;
        this.failPrice = 0;

        this.fee = 0.000675 - 0.000225;
        this.minwin = 0.0001;
        this.curvolume = 25;
        // this.minoff = 0.0003;

        this.orderstate = 0;

        this.timepriceNums = 3;
        this.timepriceTimeOff = 60 * 1000;

        // this.curOrder = undefined;
        // this.curOCOOrder = undefined;

        this.tprice = [new TimePrice(this.timepriceNums, this.timepriceTimeOff), new TimePrice(this.timepriceNums, this.timepriceTimeOff)];

        this.lastOff = 0;

        this.lstOrder = undefined;
    }

    newOrder(side) {
        if (this.orderstate != 0) {
            return ;
        }

        this.orderstate++;
        this.lstMarketInfo[1].market.ctrl.newMarketOrder(side == 1, 1);
    }

    _onDeal(dsindex, lstdeal) {
        this.rsi[dsindex].onDeal_indicator(lstdeal[dsindex]);
        let lrsi = this.rsi[dsindex].getLastVal();
        if (lrsi != undefined) {
            console.log('rsi ' + lrsi[1]);
        }

        if (lstdeal[0] && lstdeal[1]) {
            this.coupling.onDeal2_indicator(lstdeal[0], lstdeal[1]);

            let lcoupling = this.coupling.getLastVal();
            if (lcoupling != undefined) {
                console.log('coupling ' + lcoupling[1]);
            }
        }
    }

    onDeals(dsindex, newnums) {
        super.onDeals(dsindex, newnums);

        let curds = [this.lstMarket2[0].ds, this.lstMarket2[1].ds];
        let curdeal = [curds[0].deals[curds[0].deals.length - 1], curds[1].deals[curds[1].deals.length - 1]];

        if (dsindex == 0) {
            for (let i = 0; i < newnums; ++i) {
                curdeal[dsindex] = curds[dsindex].deals[curds[dsindex].deals.length - newnums + i];
                this._onDeal(dsindex, curdeal);
            }
        }
    }

    onOrder(market, order) {
        if (this.lstOrder != undefined) {
            let oknums = 0;
            for (let i = 0; i < 2; ++i) {
                if (order.lastvolume == 0 && this.lstOrder[i].mainid == order.mainid && this.lstOrder[i].indexid == order.indexid) {
                    this.lstOrder[i].isfinished = true;
                }

                if (this.lstOrder[i].isfinished) {
                    ++oknums;
                }
            }

            if (oknums == 2) {
                this.lstOrder = undefined;
            }
        }

        // if (this.curOrder != undefined) {
        //     if (order.lastvolume == 0 && this.curOrder.mainid == order.mainid && this.curOrder.indexid == order.indexid) {
        //         if (order.ordstate == ORDERSTATE.CANCELED) {
        //             this.curOrder = undefined;
        //         }
        //         else {
        //             if (order.side == ORDERSIDE.BUY) {
        //                 this.curOCOOrder = OrderMgr.singleton.newOCOOrder(
        //                     ORDERSIDE.SELL,
        //                     this.lstMarketInfo[1].market.ds.cfg.symbol,
        //                     this.destPrice,
        //                     order.avgprice - this.marketPrice[1] * 0.003,
        //                     order.volume, () => {});
        //             }
        //             else {
        //                 this.curOCOOrder = OrderMgr.singleton.newOCOOrder(
        //                     ORDERSIDE.BUY,
        //                     this.lstMarketInfo[1].market.ds.cfg.symbol,
        //                     this.destPrice,
        //                     order.avgprice + this.marketPrice[1] * 0.003,
        //                     order.volume, () => {});
        //             }
        //
        //             this.lstMarketInfo[1].market.ctrl.newOCOOrder(this.curOCOOrder);
        //         }
        //     }
        // }
        //
        // if (this.curOCOOrder != undefined) {
        //     if (order.lastvolume == 0 && order.parent && order.parent.mainid == this.curOCOOrder.mainid && order.parent.indexid == this.curOCOOrder.indexid) {
        //         this.curOrder = undefined;
        //         this.curOCOOrder = undefined;
        //     }
        // }
    }

    onTick() {
        // let curms = new Date().getTime();
        // if (this.curOrder != undefined && this.curOrder.lastvolume > 0 && (this.curOrder.ordstate == ORDERSTATE.OPEN || this.curOrder.ordstate == ORDERSTATE.RUNNING)) {
        //     let off = (this.curOrder.price - this.marketPrice[1]) / this.curOrder.price;
        //     if (Math.abs(off) >= 0.05) {
        //         this.lstMarketInfo[1].market.ctrl.deleteOrder(this.curOrder);
        //     }
        //     // else if (curms - this.curOrder.openms >= 30 * 1000) {
        //     else if (curms - this.curOrder.openms >= 3 * 60 * 1000) {
        //         this.lstMarketInfo[1].market.ctrl.deleteOrder(this.curOrder);
        //     }
        // }
    }
};

exports.Strategy2_MarketMaker3 = Strategy2_MarketMaker3;