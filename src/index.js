const Boat = require('./boat.js');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

let TWS, TWD;

app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

boat = new Boat(48.5,-38.6,0);

// Send boat data to client
app.get('/api', (request, response) => {
    poll();
    console.log("Sending boat data...");
    response.json({
        lat: boat.lat,
        lon: boat.lon,
        bsp: boat.bsp,
        hdg: boat.hdg,
        tws: TWS,
        twd: TWD
    })
})

// Receive new heading from client
app.post('/api', (request, response) => {
    console.log("I got a request!");
    
    console.log(request.body);
    boat.hdg = request.body.newHDG;
    poll();

    response.json({
        status: 'success',
        newHDG: request.body.newHDG,
        newBSP: boat.bsp
    });
    
    console.log("Confirmed boat heading: " + boat.hdg);
    
});

// Listen for client
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

// Get wind data from openweathermap API
async function getWind(lat, lon) {
    console.log(`About to fetch wind data for pos: ${lat} , ${lon}`);
    const APIkey = "1cfb3d4d2a22bb55307dd74278746b25";
    let response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${APIkey}`);
    let data = await response.json()
    return data;
}

function poll() {
getWind(boat.lat, boat.lon)
.then(data => {
    console.log(data.wind);
    TWS = data.wind.speed;
    TWD = data.wind.deg;
    boat.calcTWA(TWD);
    boat.calcBSP(TWS);
});
}

//setInterval(poll, 5000);
poll();

