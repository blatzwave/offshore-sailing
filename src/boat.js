const polar = require("./polar.json");

const R = 6371000; // Earth's radius in m.
const KNOTS_TO_MS = 0.514444;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// The polar table is irregular: TWA rows step 0,5,10,15,20,25,32,36,40,45,52,60,70...
// and TWS columns step 0,4,6,8..16,20,25..60. Rounding a reading to the nearest 10
// (as the first version did) lands on rows that don't exist, so we interpolate
// between the surrounding rows and columns instead.
const TWA_ROWS = polar.map((row) => row.TWA).sort((a, b) => a - b);
const TWS_COLS = Object.keys(polar[0])
  .filter((key) => key !== "TWA")
  .map(Number)
  .sort((a, b) => a - b);
const ROW_BY_TWA = new Map(polar.map((row) => [row.TWA, row]));

// Indices of the two table entries bracketing `value`.
function bracket(values, value) {
  if (value <= values[0]) return [0, 0];
  for (let i = 1; i < values.length; i++) {
    if (value <= values[i]) return [i - 1, i];
  }
  return [values.length - 1, values.length - 1];
}

function lerp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

// Boat speed in knots for a given absolute wind angle and wind speed,
// bilinearly interpolated from the polar table.
function polarSpeed(twaAbs, tws) {
  const twa = Math.min(Math.max(twaAbs, 0), 180);
  const wind = Math.min(Math.max(tws, 0), TWS_COLS[TWS_COLS.length - 1]);

  const [a0, a1] = bracket(TWA_ROWS, twa);
  const [w0, w1] = bracket(TWS_COLS, wind);

  const rowLow = ROW_BY_TWA.get(TWA_ROWS[a0]);
  const rowHigh = ROW_BY_TWA.get(TWA_ROWS[a1]);

  const speedLow = lerp(wind, TWS_COLS[w0], TWS_COLS[w1], rowLow[TWS_COLS[w0]], rowLow[TWS_COLS[w1]]);
  const speedHigh = lerp(wind, TWS_COLS[w0], TWS_COLS[w1], rowHigh[TWS_COLS[w0]], rowHigh[TWS_COLS[w1]]);

  const bsp = lerp(twa, TWA_ROWS[a0], TWA_ROWS[a1], speedLow, speedHigh);
  return Math.round(bsp * 10) / 10;
}

class Boat {
  constructor(bname, lat, lon) {
    this._bname = bname; // boat name
    this._lat = Number(lat); // latitude, degrees
    this._lon = Number(lon); // longitude, degrees
    this._hdg = 0; // heading, degrees true
    this._bsp = 0; // boat speed, knots
    this._twa = 0; // true wind angle, degrees (-180..180, negative = wind on port side)
    this._twd = 0; // true wind direction, degrees true
    this._tws = 0; // true wind speed, knots
    this._awa = 0; // apparent wind angle, degrees (-180..180, negative = wind on port side)
    this._aws = 0; // apparent wind speed, knots
    this._lastlog = Date.now(); // timestamp of last position fix.
  }

  // Rebuild a boat from its stored document. Coordinates are coerced because early
  // records were written as strings, and the clock is reset so a boat loaded after
  // the server was down doesn't teleport across the elapsed downtime.
  static fromDoc(doc) {
    const boat = new Boat(doc._bname, doc._lat, doc._lon);
    boat._hdg = Number(doc._hdg) || 0;
    boat._bsp = Number(doc._bsp) || 0;
    boat._twa = Number(doc._twa) || 0;
    boat._twd = Number(doc._twd) || 0;
    boat._tws = Number(doc._tws) || 0;
    boat._lastlog = Date.now();
    boat._id = doc._id;
    // Apparent wind is derived, so it isn't stored — recompute it rather than
    // leave a loaded boat reading zero until the next wind refresh.
    boat.updateApparentWind();
    return boat;
  }

  //Getters
  get id() {
    return this._id;
  }
  get bname() {
    return this._bname;
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
  get awa() {
    return this._awa;
  }
  get aws() {
    return this._aws;
  }

  // Setters
  set twd(TWD) {
    this._twd = Number(TWD);
  }
  // Knots. The weather API reports m/s, so the server converts at that boundary.
  set tws(TWS) {
    this._tws = Number(TWS);
  }
  set hdg(hdg) {
    this._hdg = Number(hdg);
  }
  set bname(bname) {
    this._bname = bname;
  }
  set id(id) {
    this._id = id;
  }

  updateBSP() {
    // Signed true wind angle normalised to -180..180.
    // Negative = wind on the port side, positive = starboard.
    this._twa = ((this._twd - this._hdg + 540) % 360) - 180;
    this._bsp = polarSpeed(Math.abs(this._twa), this._tws);
    this.updateApparentWind();
  }

  // Apparent wind is the vector sum of the true wind and the headwind the boat
  // makes by moving. Deliberately computed against boat speed through the water,
  // not speed over ground: once tide and current are modelled and the two
  // diverge, using SOG here would be wrong.
  //
  //   AWS = √(TWS² + BSP² + 2·TWS·BSP·cos TWA)
  //   AWA = atan2(TWS·sin TWA, TWS·cos TWA + BSP)
  //
  // The sign of TWA carries through, so port and starboard need no extra
  // handling, and running faster than the wind flips AWA forward on its own.
  updateApparentWind() {
    const twa = toRad(this._twa);
    const ahead = this._tws * Math.cos(twa) + this._bsp;
    const abeam = this._tws * Math.sin(twa);

    this._aws = Math.round(Math.hypot(ahead, abeam) * 10) / 10;
    this._awa = Math.round(toDeg(Math.atan2(abeam, ahead)));
  }

  distTravelled() {
    const dist = this._bsp * KNOTS_TO_MS * ((Date.now() - this._lastlog) / 1000);
    return dist > 0 ? dist : 0;
  }

  // Advance the boat along a rhumb line (see position.md). All trigonometry is done
  // in radians; lat/lon/hdg are stored in degrees.
  calcPos() {
    const dist = this.distTravelled();
    this._lastlog = Date.now();
    if (dist === 0) return;

    const δ = dist / R;
    const θ = toRad(this._hdg);
    const φ1 = toRad(this._lat);
    const λ1 = toRad(this._lon);

    const Δφ = δ * Math.cos(θ);
    let φ2 = φ1 + Δφ;

    // Check for some daft bugger going past the pole, normalise latitude if so.
    if (Math.abs(φ2) > Math.PI / 2) φ2 = φ2 > 0 ? Math.PI - φ2 : -Math.PI - φ2;

    const Δψ = Math.log(Math.tan(φ2 / 2 + Math.PI / 4) / Math.tan(φ1 / 2 + Math.PI / 4));
    const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

    const Δλ = (δ * Math.sin(θ)) / q;
    const λ2 = λ1 + Δλ;

    this._lat = toDeg(φ2);
    this._lon = ((toDeg(λ2) + 540) % 360) - 180; // normalise to -180..180
  }

  // Payload for the dashboard. `moving` is the rule behind the ship list's
  // green/red light, kept here so it can later mean aground or becalmed
  // without the client needing to change.
  state() {
    return {
      id: this._id,
      moving: this._bsp > 0,
      bname: this._bname,
      lat: this._lat,
      lon: this._lon,
      hdg: this._hdg,
      bsp: this._bsp,
      twa: this._twa,
      tws: this._tws,
      twd: this._twd,
      awa: this._awa,
      aws: this._aws,
      lastlog: this._lastlog,
    };
  }
}

module.exports = Boat;
