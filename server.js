const path = require("path");
const Boat = require("./src/boat.js");
const express = require("express");
const Datastore = require("@seald-io/nedb");
require("dotenv").config();

const POSITION_TICK_MS = 5000; // local dead-reckoning, cheap
const WIND_TICK_MS = 5 * 60 * 1000; // network calls, kept well inside free-tier limits
const MS_TO_KNOTS = 1.94384;
const DEFAULT_BOAT = { bname: "Rocinante", lat: 48.5, lon: -38.6 };

const fleet = new Map(); // _id -> Boat
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

// Write one ship's current state back to its stored document.
async function persist(b) {
  if (!b || !b.id) return;
  await database.updateAsync({ _id: b.id }, { $set: toDoc(b) });
}

// Launch a ship and add it to the fleet.
async function addBoat(bname, lat, lon) {
  const b = new Boat(bname, lat, lon);
  const doc = await database.insertAsync(toDoc(b));
  b.id = doc._id;
  fleet.set(b.id, b);
  await refreshBoatWind(b);
  console.log(`Launched ${b.bname} at ${b.lat}, ${b.lon}`);
  return b;
}

async function removeBoat(b) {
  fleet.delete(b.id);
  await database.removeAsync({ _id: b.id }, {});
  console.log(`Removed ${b.bname}`);
}

// Load the stored fleet, or seed a default ship on first run.
async function loadFleet() {
  const docs = await database.findAsync({});
  for (const doc of docs) {
    const b = Boat.fromDoc(doc);
    fleet.set(b.id, b);
  }

  if (fleet.size) {
    console.log(`Loaded ${fleet.size} ship(s): ${[...fleet.values()].map((b) => b.bname).join(", ")}`);
    await refreshWind();
  } else {
    await addBoat(DEFAULT_BOAT.bname, DEFAULT_BOAT.lat, DEFAULT_BOAT.lon);
  }
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
// builds slowly, and differs by position so ships in different oceans don't all
// sail in lockstep. Flagged as simulated in the API response.
function simulatedWind(lat, lon) {
  const t = Date.now();
  const phase = (lat + lon) * (Math.PI / 180);
  return {
    deg: (240 + 25 * Math.sin(t / 600000 + phase) + 360) % 360,
    knots: 13 + 5 * Math.sin(t / 900000 + phase * 1.7),
  };
}

async function refreshBoatWind(b) {
  if (!process.env.API_KEY) {
    const wind = simulatedWind(b.lat, b.lon);
    b.twd = Math.round(wind.deg);
    b.tws = Math.round(wind.knots * 10) / 10;
    b.updateBSP();
    windSource = "simulated";
    await persist(b);
    return;
  }

  try {
    const data = await getWind(b.lat, b.lon);
    b.twd = data.wind.deg;
    b.tws = Math.round(data.wind.speed * MS_TO_KNOTS * 10) / 10;
    b.updateBSP();
    windSource = "live";
    await persist(b);
  } catch (error) {
    // Keep sailing on the last known wind rather than stopping the ship.
    console.error(`Could not refresh wind for ${b.bname} (${error.message}); keeping last reading.`);
    if (windSource === "none") windSource = "simulated";
  }
}

// Sequential rather than parallel, to stay polite to the weather API.
async function refreshWind() {
  for (const b of fleet.values()) {
    await refreshBoatWind(b);
  }
}

// Advance every ship's position by dead reckoning.
async function tick() {
  for (const b of fleet.values()) {
    b.calcPos();
  }
  await Promise.all([...fleet.values()].map((b) => persist(b)));
}

function badRequest(response, message) {
  return response.status(400).json({ status: "error", message });
}

function parseCoord(value, limit) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

// Resolve :id to a ship, answering 404 if there isn't one.
function findBoat(request, response) {
  const b = fleet.get(request.params.id);
  if (!b) {
    response.status(404).json({ status: "error", message: "No such ship" });
    return null;
  }
  return b;
}

// EXPRESS  ///////////////////////////////////////////////////////

// The whole fleet. Each entry carries full state, so the dashboard needs only
// this one call per refresh to draw both the ship list and the instruments.
app.get("/api/boats", (request, response) => {
  response.json({
    windSource,
    boats: [...fleet.values()].map((b) => b.state()),
  });
});

// Launch a ship.
app.post("/api/boats", async (request, response) => {
  const name = String(request.body.boatname || "").trim();
  const lat = parseCoord(request.body.newLat, 90);
  const lon = parseCoord(request.body.newLon, 180);

  if (!name) return badRequest(response, "Ship needs a name");
  if (lat === null) return badRequest(response, "Latitude must be between -90 and 90");
  if (lon === null) return badRequest(response, "Longitude must be between -180 and 180");

  const b = await addBoat(name, lat, lon);
  response.status(201).json({ status: "success", windSource, boat: b.state() });
});

// Steer a ship.
app.post("/api/boats/:id/heading", async (request, response) => {
  const b = findBoat(request, response);
  if (!b) return;

  const hdg = Number(request.body.newHDG);
  if (!Number.isFinite(hdg) || hdg < 0 || hdg > 360) {
    return badRequest(response, "Heading must be a number between 0 and 360");
  }

  // Bank the distance run on the old heading before turning.
  b.calcPos();
  b.hdg = hdg % 360;
  b.updateBSP();
  await persist(b);

  console.log(`${b.bname} steering ${b.hdg}° — boat speed ${b.bsp} kts`);
  response.json({ status: "success", windSource, boat: b.state() });
});

// Scuttle a ship.
app.delete("/api/boats/:id", async (request, response) => {
  const b = findBoat(request, response);
  if (!b) return;

  await removeBoat(b);
  response.json({ status: "success", id: b.id });
});

// MAIN  //////////////////////////////////////////////////////////////

loadFleet()
  .then(() => {
    setInterval(() => tick().catch((err) => console.error(err)), POSITION_TICK_MS);
    setInterval(() => refreshWind().catch((err) => console.error(err)), WIND_TICK_MS);
    app.listen(port, () => console.log(`Starting server at ${port}`));
  })
  .catch((error) => {
    console.error("Failed to start:", error);
    process.exit(1);
  });
