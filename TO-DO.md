# TO DO

- ~~Define method for caculating new position (lat, long) from an initial position, bearing (rel. to true north) and speed. See file: _position.md_.~~
- ~~Code boat class. See file: _boat.js_.~~
- ~~Find polar chart for IMOCA60 (well-known offshore racing class) or equivalent.~~
  - ~~Convert to CSV or JSON format.~~
- ~~Find free wind data API.~~
  - ~~Code API request. See file: _getWind.js_.~~
- ~~Wireframe interface.~~ Built as an instrument-panel dashboard in _src/public/index.html_.
- Choose project name.
- ~~Find host for app and interface.~~
- Code user authentication
- Deploy app on Heroku
- Determine mapping system to display player boats and wind data. (leaflet.js or D3js?)

## Next up

- Add a real wind API key: copy `.env_sample` to `.env` and set `API_KEY` to an
  openweathermap.org key. Until then the server falls back to a simulated breeze and the
  dashboard reads SIMULATED WIND. Note that a key can take a couple of hours to activate,
  and the original 2020 key may have lapsed — either way it shows up as a 401 in the log.
- Apparent wind angle and speed (AWA/AWS) from boat speed and true wind.
- Land collision and depth. See _Depth and land: the approach_ below.
- Speed and course over ground, once tide/current is modelled — until then boat speed through the water is all the simulator knows.
- Sail configuration, which the current polar table has no dimension for.
- Multiplayer: the server currently keeps a single boat in memory. Supporting more means
  per-player boat state and sessions rather than one module-level `boat`.

## Depth and land: the approach

Two separate questions that want two different data structures.

**Am I aground?** A boundary, so store it as vector polygons rather than a raster. Natural
Earth 1:10m coastline is about 10MB, gives an exact inside/outside test with no
stair-stepping along the shore, and needs no preprocessing. Load at boot, bounding-box
prefilter, ray-cast point-in-polygon. This ships independently of the depth work below, so
do it first.

Checking the new position each tick is enough. At a 5s tick a fast boat covers about 50m,
so it cannot step over an island. That assumption breaks if time acceleration is ever
added, at which point the check has to be against the segment from the old position to the
new one — but time acceleration is not planned.

**How deep is it?** A scalar field, so a raster, at variable resolution. Uniform
15-arcsecond coverage of the globe is 7.5GB, which is unshippable. A coarse 5-arcmin base
(19MB) plus 15-arcsecond detail within 5km of a coast (33MB) is ~52MB for the same fidelity
where it matters, roughly a 140x saving, and fits inside Heroku's 500MB slug limit.

Resolution is chosen by the **shallowest point in each cell, not its mean depth**. Keying
on the mean erases the features that matter: a seamount rising from 2000m to 5m averages
out to "deep, no detail needed" and gets flattened, and Pacific atolls disappear entirely
at the first downsample. Keep a cell fine where its minimum depth is shallow or its
variance is high; the abyssal plains coarsen away to nothing because they really are flat.

Note this is a build-time pass over full GEBCO, not a runtime decision — the fine data is
needed to work out where the fine data is not needed. Most of the work is the offline
pipeline (GDAL, tiling, packing); the lookup at the end is on the order of a hundred lines.

Keep the runtime structure dumb. At one boat and one lookup per five seconds, lookup speed
is irrelevant and a real quadtree's per-node overhead can eat the savings being chased. Two
or three fixed levels in a sparse tile pyramid, lazily loaded with a small LRU cache, gets
essentially the whole benefit. Optimise for file size and for how easily the offline build
can be re-run.
