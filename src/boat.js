const fetch = require("node-fetch");
const polar = require("./polar.json");

class Boat {
  constructor(lat, lon, hdg) {
    this._lat = lat; // latitude
    this._lon = lon; // longitude
    this._hdg = hdg; // heading
    this._bsp = 10; // boat speed
    this._twa = 0; // true wind angle
    this._twd; // true wind direction
    this._tws; // true wind speed
    this._lastlog = Date.now(); // timestamp of last position.
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
  get hdg() {
    return this._hdg;
  }
  get bsp() {
    return this._bsp;
  }
  get tws() {
    return this._tws;
  }
  get twa() {
    return this._twa;
  }
  get twd() {
    return this._twd;
  }
  set twd(TWD) {
    this._twd = TWD;
  }
  set tws(TWS) {
    this._tws = (TWS * 1.94).toFixed(1);
  }
  set hdg(hdg) {
    this._hdg = hdg;
  }

  updateBSP() {
    let roundedTWS;
    // Normalize heading to between 0 and 180.
    if (Math.abs(this._twd - this._hdg) > 180) {
      this._twa = 360 - this._twd + this._hdg;
    } else {
      this._twa = this._twd - this._hdg;
    }

    // round TWS to nearest 10 (as per polar)
    let roundedTWA = Math.abs(Math.round(this._twa / 10) * 10);
    console.log(`Rounded TWA: ${roundedTWA}`);

    // Round TWS to neares 2 or 5 (as per polar)
    if (this._tws >= 20) {
      roundedTWS = Math.round(this._tws / 5) * 5;
    } else {
      roundedTWS = Math.round(this._tws / 2) * 2;
    }
    console.log("Rounded wind speed: " + roundedTWS);

    // Find boat speed from polar
    for (const i of polar) {
      if (i.TWA === roundedTWA) {
        console.log("Found the polar object!");
        //console.log(i);
        this._bsp = i[roundedTWS];
        console.log("Boat speed: " + this._bsp);
      }
    }
  }


distTravelled() {
  let metricBSP = this._bsp * 0.514;
  let dist = metricBSP * ((Date.now() - this._lastlog) / 1000);
  //console.log("Distance travelled: " + dist + "m");
  return dist;
}

calcPos() {
  const R = 6371000; // Earths radius in m.
  let θ =  this._hdg;
  let φ1 = this._lat;
  let λ1 = this._lon;

  const δ = this.distTravelled() / R;
  const Δφ = δ * Math.cos(θ);
  const φ2 = φ1 + Δφ;

  const Δψ = Math.log(Math.tan(φ2 / 2 + Math.PI / 4) / Math.tan(φ1 / 2 + Math.PI / 4));
  const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

  const Δλ = (δ * Math.sin(θ)) / q;
  const λ2 = λ1 + Δλ;

  // check for some daft bugger going past the pole, normalise latitude if so
  if (Math.abs(φ2) > Math.PI / 2) φ2 === φ2 > 0 ? Math.PI - φ2 : -Math.PI - φ2;

  this._lat = φ2;
  this._lon = λ2;

  this._lastlog = Date.now();

  console.log(`New position: ${this._lat}, ${this._lon}`);
}
}
module.exports = Boat;

