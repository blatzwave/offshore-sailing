# offshore-sailing
An online application to simulate sailing high performance boats offshore by continuos computing of their position, heading and speed.

## Project Names: ##

The project needs a name. Here are some options:

* openOcean
* nOcean

## Goal ##

The main project goal is to openly develop a simple application to allow for multiplayer virtual offshore sailing based on real-time weather data, in a similar way to Virtual Regatta Offshore (www.virtualregatta.com). At sea, a skipper/navigator would be aware or able to deduce their current position, speed over ground and course over ground, and every serious (armchair) sailor with offshore sailing dreams will be aware of the various charting tools available to visualize a boat's current position and to plot a future course, so visualization will not be the initial focus of this project. 

In the same way this project does not intend to compete directly with existing platforms' GUIs, it does intend to bring deeper virtualizations of the offshore experience to the player. These maybe in the form of finer sail trim, boat damage and various elements of risk.

In summary, this project aims at creating an server-hosted application to compute global positional coordinates, boat speed and heading based on a set of a craft's known polar speed graphs and real-time weather data, and deliver the data to the player on request. For this purpose, a member-access website will provide the interface to request and display the data to the player. This same interface will allow the player to input a new heading and sail configuration.

As the project creator, I have a personal goal of developing javascript coding skills as well as gaining experience with an open-source process, which will bias certain technical choices.

## Features (MVP) ##

Built:

* Launch ships at chosen coordinates
* Change heading
* View current position
* Live instrument dashboard reading boat speed, true wind speed, true wind angle, true wind
  direction, and apparent wind speed and angle
* Multiple ships, listed with a green/red light showing under way or stopped

Still to do:

* Change sail configuration
* View current course over ground (CoG)
* View current speed over ground (SoG)
* View boat polar graphs
* Land collision
* Depth

## Proposed features ##

* Mapping of boats with wind overlay
* Plotting of future positions (up to 24h)
* Weather forecast
* Racing
* Velocity made good (VMG) calculation
* Plotting of optimum course to mark
* Sail-reefing

## Technical requirements ##

* Nodejs server-side application

## Running locally

1. Install Node.js 18 or later (www.nodejs.org)
2. Clone repo to local folder
3. Navigate to project folder using your command line
4. Run `npm install`
5. Run `npm run dev` to start the local server
6. Use browser to visit `localhost:3000`

The boat sails on a simulated breeze out of the box. For real wind, copy `.env_sample`
to `.env` and add an [openweathermap.org](https://openweathermap.org/) API key. The
dashboard says which of the two it is reading.

Ships are stored in `database.db` and keep sailing while the server runs. Launch as many as
you like; the ship list on the left switches the instruments between them, and a green light
means under way, red means stopped.

# Contributions are welcome! #

