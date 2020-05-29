const Boat = require("./boat.js");
const express = require("express");
const fetch = require("node-fetch");
require('dotenv').config();

//console.log(process.env);

const app = express();
const port = 3000;

// Wind variable. Do these need to be global?
let TWS, TWD;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));

// Create boat at given coordinates and heading.
boat = new Boat(48.5, -38.6, 0);

// Send boat data to client on request.
app.get("/api", (request, response) => {
  getWind(boat.lat, boat.lon);
  boat.updateBSP();
  console.log("Sending boat data...");
  response.json({
    lat: boat.lat,
    lon: boat.lon,
    bsp: boat.bsp,
    hdg: boat.hdg,
    twa: boat.twa,
    tws: boat.tws,
    twd: boat.twd,
  });
});

// Receive new heading from client
app.post("/api", (request, response) => {
  console.log("I got a request!");

  console.log(request.body);
  boat.hdg = parseInt(request.body.newHDG);
  boat.updateBSP();
  response.json({
    status: "success",
    newHDG: request.body.newHDG,
    newBSP: boat.bsp,
  });

  console.log("Confirmed boat heading: " + boat.hdg);
});

// Listen for client
app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);

// Get wind data from openweathermap API
async function getWind(lat, lon) {
  console.log(`About to fetch wind data for pos: ${lat} , ${lon}`);
  const APIkey = process.env.API_KEY;
  let response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${APIkey}`
  );
  let data = await response.json();
  return data;
}

getWind(boat.lat, boat.lon)
  .then((data) => {
    console.log("Got wind data:");
    console.log(data.wind);
    boat.tws = data.wind.speed;
    boat.twd = data.wind.deg;
    boat.updateBSP();
  })
  .catch((error) => {
    console.error("Error getting wind...");
    console.error(error);
  });

function pollPos() {}

setInterval(() => {
  if (boat.distTravelled() > 50) {
    console.log("Calculating position...");
    boat.calcPos();
  } else {
    console.log(`Distance travelled: ${boat.distTravelled()}m`);
  }
}, 5000);
