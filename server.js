const Boat = require("./src/boat.js");
const express = require("express");
const fetch = require("node-fetch");
const Datastore = require('nedb');
require('dotenv').config();

let boat;

//Expressjs
const app = express();
const port = process.env.PORT || 3000;
app.use(express.static("./src/public"));
app.use(express.json({ limit: "1mb" }));

// neDB
const database = new Datastore('database.db');
database.loadDatabase();

// MAIN  //////////////////////////////////////////////////////////////

newBoat('boat', 48.5, -38.6);

  database.count({}, function (err, count) {
    console.log("Count: " + count);
    console.error(err);
    for (let i = 0; i <= count-1; i++) {
      console.log("current SID:" + i);
      database.findOne({ _sid: i }, function (err, doc) {
      boat.bname = doc._bname; // boat name
      boat.lon = doc._lon; // longitude
      boat.lat = doc._lat; // latitude
      boat.hdg = doc._hdg; // heading
      boat.bsp = doc._bsp; // boat speed
      boat.twa = doc._twa; // true wind angle
      boat.twd = doc._twd; // true wind direction
      boat.tws = doc._tws; // true wind speed
      boat.lastlog = doc._lastlog; // timestamp of last position.
      boat.sid = doc._sid; // Sequential id.
      boat.id = doc._id;
      weather();
      boat.calcPos();
      console.log("Calculated for SID:" + i);
    });
  }});

// FUNCTIONS  ////////////////////////////////////////////////////////////

// Remove current boat from database
function deleteBoat(targetBoat){
  database.remove({ _bname: targetBoat }, {}, function (err, numRemoved) {
    // numRemoved = 1
    console.log(`Deleted ${boat.bname} from database.`);
  });
}

// Create boat at given coordinates and heading.
function newBoat(bname, lat, lon) {
  console.log("New boat instance!");
  // Count all documents in the datastore
  database.count({}, function (err, count) {
    // Add sequential id to boat instance
    console.log(`Total boats: ${count}`);
    boat = new Boat(bname, lat, lon, count);
    database.insert(boat, function (err, newEntry) {   // Callback is optional
    console.log("New entry in DB: " + newEntry._bname);
    //weather();
    });
  });
  
  
  }

  function loadBoat(bname) {
    database.findOne({_bname: bname }, function (err, doc) {
      console.log('Found this in the DB: '+ doc._bname);

      boat._bname = doc._bname; // boat name
      boat._lat = doc._lat; // latitude
      boat._lon = doc._lon; // longitude
      boat._hdg = doc._hdg; // heading
      boat._bsp = doc._bsp; // boat speed
      boat._twa = doc._twa; // true wind angle
      boat._twd = doc._twd;// true wind direction
      boat._tws = doc._tws;// true wind speed
      boat._lastlog = doc._lastlog; // timestamp of last position.
      boat._sid = doc._sid; // seq ID
    });
    //weather();
  }



// Get wind data from openweathermap API
async function getWind(lat, lon) {
  console.log(`About to fetch wind data for pos: ${lat} , ${lon}`);
  const APIkey = process.env.API_KEY;

  let response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${APIkey}`);
  let data = await response.json();
  return data;
}

function weather() {
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
}

// EXPRESS  ///////////////////////////////////////////////////////

// Send boat list to client on request.
app.get("/list", (request, response) => {
  console.log(`Got a request ${request.body.json}`);
  console.log("Sending boat list...");
  database.find({}, function (err, doc) {
    response.json(doc);
    console.error(err);
  });
});

// Send boat data to client on request.
app.get("/api", (request, response) => {
  console.log(`Got a request ${request}`);
  console.log("Sending boat data...");
  response.json({
    bname: boat.bname,
    lat: boat.lat,
    lon: boat.lon,
    bsp: boat.bsp,
    hdg: boat.hdg,
    twa: boat.twa,
    tws: boat.tws,
    twd: boat.twd,
  });
});

// Receive delete order from client
app.post("/del", (request, response) => {
  console.log("I got a request!");
  console.log(request.body);
  deleteBoat(request.body.targetb);
  response.json({
    status: "success",
    bname: boat.bname
  });
  console.log("Confirmed boat deleted: " + boat.bname);
  
});

// Receive new heading from client
app.post("/api", (request, response) => {
  console.log("I got a request!");

  console.log(request.body);
  boat.hdg = parseInt(request.body.newHDG);
  database.update({ _sid: boat.sid }, { $set: { _hdg: boat.hdg } }, function (err, numReplaced) {
    console.log("boat: " + boat.sid);
    console.log(`Num replaced ${numReplaced}`);
  });
  boat.updateBSP();
  response.json({
    status: "success",
    newHDG: request.body.newHDG,
    newBSP: boat.bsp,
  });
  console.log("Confirmed boat heading: " + boat.hdg);
});

// Receive boat selection from client
app.post("/list", (request, response) => {
  console.log("I got a request!");
  console.log(request.body);
  loadBoat(request.body.selBoat);
  
  response.json({
    status: "success",
  });
  console.log("Boat selected: " + boat.bname);
  
});

// Receive new boat instruction client
app.post("/new", (request, response) => {
  console.log("I got a request!");
  
  let datar = request.body;
  console.log(datar);
 // let datap = JSON.parse(datar);
  console.log(datar);
  newBoat(datar.boatname, request.body.newLat, request.body.newLon);
  
  response.json({
    status: "success",
    boatname: boat.bname
  });
  console.log("Boat created: " + boat.bname);
});

// Listen for client
app.listen(port, () =>
  console.log(`Starting server at ${port}`)
);

