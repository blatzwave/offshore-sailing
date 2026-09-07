const path = require("path");
const Boat = require("./src/boat.js");
const express = require("express");
const Datastore = require("@seald-io/nedb");
require("dotenv").config();

const POSITION_TICK_MS = 5000; // local dead-reckoning, cheap
const WIND_TICK_MS = 5 * 60 * 1000; // network call, kept well inside free-tier limits
const MS_TO_KNOTS = 1.94384;
const DEFAULT_BOAT = { bname: "Rocinante", lat: 48.5, lon: -38.6 };

let boat; // the single active boat — this is a single-player simulator
let windSource = "none"; // "live" | "simulated" | "none"

//Expressjs
const app = express();
const port = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "src", "public")));
app.use(express.json({ limit: "1mb" }));

// neDB
const database = new Datastore({ filename: path.join(__dirname, "database.db"), autoload: true });

// FUNCTIONS  ////////////////////////////////////////////////////////////

// The stored document shape (underscore-prefixed, as the first version wrote it).
function toDoc(b) {
  const s = b.state();
  return {
    _bname: s.bname,
    _lat: s.lat,
    _lon: s.lon,
    _hdg: s.hdg,
    _bsp: s.bsp,
    _twa: s.twa,
    _twd: s.twd,
    _tws: s.tws,
    _lastlog: s.lastlog,
  };
}

// Write the boat's current state back to its stored document.
async function persist() {
  if (!boat || !boat.id) return;
  await database.updateAsync({ _id: boat.id }, { $set: toDoc(boat) });
}

// Replace the active boat with a new one at the given coordinates.
// Single-player: one boat per server, so the old record goes.
async function newBoat(bname, lat, lon) {
  await database.removeAsync({}, { multi: true });
  boat = new Boat(bname, lat, lon);
  const doc = await database.insertAsync(toDoc(boat));
  boat.id = doc._id;
  console.log(`Launched ${boat.bname} at ${boat.lat}, ${boat.lon}`);
  await refreshWind();
  return boat;
}

// Load the stored boat, or seed a default one on first run.
async function loadBoat() {
  const doc = await database.findOneAsync({});
  if (doc) {
    boat = Boat.fromDoc(doc);
    console.log(`Loaded ${boat.bname} at ${boat.lat}, ${boat.lon}`);
    await refreshWind();
    return boat;
  }
  return newBoat(DEFAULT_BOAT.bname, DEFAULT_BOAT.lat, DEFAULT_BOAT.lon);
}

// Get wind data from openweathermap API
async function getWind(lat, lon) {
  const APIkey = process.env.API_KEY;
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${APIkey}`
  );
  if (!response.ok) throw new Error(`weather API responded ${response.status}`);
  return response.json();
}

// Stand-in wind for running without an API key: a steady breeze that veers and
// builds slowly, so the simulator is still usable offline. Flagged as simulated
// in the API response so the dashboard can say so.
function simulatedWind() {
  const t = Date.now();
  return {
    deg: (240 + 15 * Math.sin(t / 600000) + 360) % 360,
    knots: 14 + 4 * Math.sin(t / 900000),
  };
}

async function refreshWind() {
  if (!boat) return;

  if (!process.env.API_KEY) {
    const wind = simulatedWind();
    boat.twd = Math.round(wind.deg);
    boat.tws = Math.round(wind.knots * 10) / 10;
    boat.updateBSP();
    windSource = "simulated";
    await persist();
    return;
  }

  try {
    const data = await getWind(boat.lat, boat.lon);
    boat.twd = data.wind.deg;
    boat.tws = Math.round(data.wind.speed * MS_TO_KNOTS * 10) / 10;
    boat.updateBSP();
    windSource = "live";
    console.log(`Wind: ${boat.tws} kts from ${boat.twd}°`);
    await persist();
  } catch (error) {
    // Keep sailing on the last known wind rather than stopping the boat.
    console.error(`Could not refresh wind (${error.message}); keeping last reading.`);
    if (windSource === "none") windSource = "simulated";
  }
}

// Advance the boat's position by dead reckoning.
async function tick() {
  if (!boat) return;
  boat.calcPos();
  await persist();
}

function badRequest(response, message) {
  return response.status(400).json({ status: "error", message });
}

function parseCoord(value, limit) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

// EXPRESS  ///////////////////////////////////////////////////////

// Send boat data to client on request.
app.get("/api", (request, response) => {
  if (!boat) return response.status(503).json({ status: "error", message: "No boat yet" });
  response.json({ ...boat.state(), windSource });
});

// Receive new heading from client
app.post("/api", async (request, response) => {
  if (!boat) return response.status(503).json({ status: "error", message: "No boat yet" });

  const hdg = Number(request.body.newHDG);
  if (!Number.isFinite(hdg) || hdg < 0 || hdg > 360) {
    return badRequest(response, "Heading must be a number between 0 and 360");
  }

  // Bank the distance run on the old heading before turning.
  boat.calcPos();
  boat.hdg = hdg % 360;
  boat.updateBSP();
  await persist();

  console.log(`New heading: ${boat.hdg}° — boat speed ${boat.bsp} kts`);
  response.json({ status: "success", ...boat.state(), windSource });
});

// Receive new boat instruction from client
app.post("/new", async (request, response) => {
  const name = String(request.body.boatname || "").trim();
  const lat = parseCoord(request.body.newLat, 90);
  const lon = parseCoord(request.body.newLon, 180);

  if (!name) return badRequest(response, "Boat needs a name");
  if (lat === null) return badRequest(response, "Latitude must be between -90 and 90");
  if (lon === null) return badRequest(response, "Longitude must be between -180 and 180");

  await newBoat(name, lat, lon);
  response.json({ status: "success", ...boat.state(), windSource });
});

// MAIN  //////////////////////////////////////////////////////////////

loadBoat()
  .then(() => {
    setInterval(() => tick().catch((err) => console.error(err)), POSITION_TICK_MS);
    setInterval(() => refreshWind().catch((err) => console.error(err)), WIND_TICK_MS);
    app.listen(port, () => console.log(`Starting server at ${port}`));
  })
  .catch((error) => {
    console.error("Failed to start:", error);
    process.exit(1);
  });
