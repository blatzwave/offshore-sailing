class Boat () {
    constructor (lat, lon, hdg) {
        this.lat = lat; // latitude
        this.lon = lon; // longitude
        this.hdg = hdg; // heading
        this.bsp = 0;   // boat speed
    }

    currPos () {
        console.log("Latitude: " + this.lat + "Longitude: " + this.lon);
    }
    
}