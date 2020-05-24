class Boat {
    constructor (lat, lon, hdg) {
        this._lat = lat; // latitude
        this._lon = lon; // longitude
        this._hdg = hdg; // heading
        this._bsp = 0;   // boat speed
    }

    currPos() {
        console.log("Latitude: " + this._lat + ", Longitude: " + this._lon);
    }

    get lat() {
        return this._lat;
    }

    get lon() {
        return this._lon;
    }

    set hdg(hdg) {
        this._hdg = hdg;
    }
    
    calcBSP() {
        this._bsp = 7;
    }
}

module.exports = Boat;