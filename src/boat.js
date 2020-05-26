const fetch = require('node-fetch');
const polar = require("./polar.json");

class Boat {
    constructor (lat, lon, hdg) {
        this._lat = lat; // latitude
        this._lon = lon; // longitude
        this._hdg = hdg; // heading
        this._bsp = 10;   // boat speed
        this._twa = 0; // true wind angle
    }

    currPos() {
        console.log("Latitude: " + this._lat + ", Longitude: " + this._lon);
    }

    distTravelled() {
        metricBSP = this._bsp * 0.514;
        dist = metricBSP * 30;
        return dist;
    }

    get lat() {
        return this._lat;
    }

    get lon() {
        return this._lon;
    }

    get hdg() {
        return this._hdg;
    }

    get bsp() {
        return this._bsp;
    }

    calcTWA(TWD) {
        if (TWD > 180) { TWD = Math.round(360 - TWD); }
        this._twa = TWD - this._hdg;
        this._twa = Math.round(this._twa/10) * 10;
        console.log(`Rounded TWA: ${this._twa}`);
    }

    calcBSP(TWS) {
        TWS *= 1.94; // Convert to kts
        if (TWS >= 20) {
            TWS = Math.round(TWS/5) * 5;
        } else { 
            TWS = Math.round(TWS/2) * 2;
        }
        console.log("Rounded wind speed: " + TWS);


        for (const i of polar) {
            if (i.TWA === Math.abs(this._twa)) {
                console.log("Found the polar object!");
                //console.log(i);
                this._bsp = i[TWS];
                console.log("Boat speed: " + this._bsp);
            }
        };
    }

    set hdg(hdg) {
        this._hdg = hdg;
    }
    
    logPolar () {
        console.log(polar);
    }


}

module.exports = Boat;