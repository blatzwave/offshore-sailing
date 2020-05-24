class Boat {
    constructor (lat, lon, hdg) {
        this._lat = lat; // latitude
        this._lon = lon; // longitude
        this._hdg = hdg; // heading
        this._bsp = 10;   // boat speed
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

    set hdg(hdg) {
        this._hdg = hdg;
    }
    
    


}

module.exports = Boat;