const Boat = require('./boat.js');

const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

boat = new Boat(0,0,0);
boat.currPos();

app.post('/api', (request, response) => {
    console.log("I got a request!");
    console.log(request.body);
    response.json({
        status: 'success',
        newHDG: request.body.newHDG
    });
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));



