"use strict";

const { ORDERSIDE, ORDERTYPE, ORDERSTATE } = require('./basedef');

// order
// order.symbol
// order.side           - ORDERSIDE
// order.openms
// order.closems
// order.ordtype        - ORDERTYPE
// order.price
// order.volume
// order.avgprice
// order.lastvolume
// order.lstchild
// order.parent
// order.clordid        - mainid-indexid
// order.clordlinkid    - linkid
// order.ordstate       - ORDERSTATE
// order.mainid         - main id
// order.indexid        - index id
// order.ordid          - serv id
// order.parentindexid  - parent indexid

function countOrderList(lst) {
    let v = 0;
    let p = 0;
    let win = 0;
    let opennums = 0;

    for (let i = 0; i < lst.length; ++i) {
        let co = lst[i];

        if (co.lastvolume > 0) {
            opennums++;
        }

        let cv = co.volume - co.lastvolume;
        if (cv == 0) {
            continue ;
        }

        let ov = co.side * cv;
        if (v == 0) {
            p = co.avgprice;
            v = ov;
        }
        else if (v / ov > 0) {
            p = (p * Math.abs(v) + co.avgprice * cv) / (Math.abs(v) + cv);
            v += ov;
        }
        else {
            let lm = (co.avgprice - p) * Math.abs(ov) * (v < 0 ? -1 : 1);
            win += lm;
            v += ov;
        }
    }

    if (v == 0) {
        p = 0;
    }

    return {
        lastvolume: v,
        avgprice: p,
        win: win,
        opennums: opennums
    };
}

exports.countOrderList = countOrderList;