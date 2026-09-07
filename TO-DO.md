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
In rough priority order:

- **Autopilot holding a true wind angle** rather than a compass heading. Best value for the
  work of anything on this list. The boat then responds to shifts on its own, which turns
  the game from "set a heading and watch it go stale" into "set a strategy and let it run",
  and it is how boats are actually sailed offshore. It also makes being away from the
  dashboard survivable.
- **Forecast wind, not just current conditions.** The sim fetches current wind at the boat's
  position, which is enough to move a boat but not to plan a passage. Without a forecast
  field over an area the player is reacting blindly and skill cannot express itself, so a
  good router and a coin flip score about the same. NOAA GFS GRIBs are free. This is the
  largest single piece of work here and it blocks both the passage-planning premise and
  racing (see below).
- Land collision. See _Depth and land: the approach_ below.
- Apparent wind angle and speed (AWA/AWS) from boat speed and true wind.
- A deliberately minimal map: own position and track only, no weather overlay. The point of
  the project is that real charting and routing tools work against it, so an in-game map
  good enough to replace Windy would remove the reason to prefer this over other sims.
- Depth. Lower priority than it looks — see the note in the depth section below.
- Speed and course over ground, once tide/current is modelled — until then boat speed through the water is all the simulator knows.
- Sail configuration, which the current polar table has no dimension for.
- Multiplayer and racing. See _Multiplayer and racing_ below.

## Depth and land: the approach

Two separate questions that want two different data structures. Note the priority gap
between them: land collision is what makes routing decisions real, since islands and
headlands are what a route has to be planned around. Depth barely matters offshore — a
boat is over abyssal plain for most of a crossing and the instrument reads 4000-something
metres for weeks on end. Build the coastline half; the bathymetry half can wait until
there is coastal sailing worth the effort.

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

## Multiplayer and racing

Multiplayer is the retention mechanic, not a scaling exercise. A solo crossing loses its
novelty around day ten with nothing pulling the player back; a fleet that left on the same
Sunday and can be compared against daily is a different proposition. Correspondence chess
works because someone is waiting.

**Scheduled fleet starts, not rolling ones.** Everyone leaving at a fixed time puts the
whole fleet on a shared clock, so players are on day nine together and have something to
talk about. Rolling starts scatter everyone across different points of the course and
there is no common ground.

**The daily position report is the hook.** Real ocean racing has the sched at fixed times,
when the fleet finds out simultaneously who gained overnight — it is the emotional spine of
the Vendée Globe for anyone following from shore. One notification at a set hour with the
standings gives an otherwise ambient game a reason to come back at a specific moment, and
it is drawn from the sport rather than bolted on.

**Between scheds, show a player only their own boat.** Withholding live competitor
positions is the competitive differentiator. Virtual Regatta shows rivals on a map, so the
game becomes covering and marking; if all a player has is their own instruments and the
forecast, they have to commit to a route on conviction and find out later whether it paid.
That is a purer test of navigation and nobody else offers it.

**Rank by routed ETA, not distance to finish.** DTF is the obvious metric and the one the
real trackers display, but it produces false leaders: a boat further away in a straight
line but on the favoured side of a system is often genuinely ahead. Worse, ranking on it
pushes players to sail at the mark instead of sailing the best route, which inverts the
skill the game is meant to reward. Run the router from each boat on the current forecast
and sort by projected finish time. Affordable at one calculation per boat every few hours.
Display DTF by all means, just don't rank on it.

**Charge a time penalty for manoeuvres.** Without one, a player checking every fifteen
minutes beats a player checking twice a day on reaction time alone — attentiveness rather
than skill, which breaks the premise. A realistic couple of minutes of lost speed for a
gybe or sail change is physically accurate and removes the twitch advantage at the same
time.

**Racing makes shared, versioned weather mandatory.** Every boat must sail the same field,
and two boats ticking at the same moment must read the same forecast run. That rules out
per-boat current-conditions lookups and promotes the GRIB work from important to blocking.
It is also what makes a result reproducible when someone disputes a finish.

**Finish lines are lines.** Two coordinates crossed in the correct direction, detected as a
segment intersection against the boat's movement during a tick. A point-based finish forces
an arbitrary "close enough" radius. The same structure does start lines, and it is how real
racing is scored.

**One-design to begin with.** Everyone on the same polar. There is only one polar in the
repo, the IMOCA60 is effectively a box rule anyway, and it avoids a category of balance
work that is not needed yet.

**Server changes.** `boat` becomes a collection, the tick iterates a fleet, and the user
authentication already on the list above becomes a prerequisite rather than a nicety. The
per-boat compute stays trivial — a thousand boats each taking one rhumb-line step every
five seconds is nothing. What actually scales is GRIB storage and the routing calculations
behind the standings.

## Stack and hosting for multiplayer

One constraint decides most of this: **the server has to run continuously**, because boats
sail while players are offline. That rules out the whole serverless tier — Lambda, Vercel
functions, Cloudflare Workers — since "free tier" on those platforms means scaling to zero,
which is the one thing this workload cannot do. The compute itself is trivial; the box is
being rented to stay awake, not to be fast.

- **Runtime:** stay on Node and Express. Nothing here wants a rewrite. One process, single
  writer.
- **Database:** SQLite on the box via `better-sqlite3`, with Litestream streaming a
  continuous backup to object storage. The data is tiny — a boat record is a couple of
  hundred bytes, so a thousand players is ~200KB and the fleet lives in RAM. Move off NeDB
  at this point: joins for users-to-boats and real transactions for race results are worth
  having.
- **Auth:** self-hosted. Email and password with `bcrypt` and a signed session cookie is
  about a hundred lines and free forever; Better Auth is a fair library alternative. Prefer
  GitHub or Google OAuth as the main path, because it removes password resets, which are
  the part that actually costs money (see email below). Managed auth is free at this scale
  but adds lock-in for little gain.
- **TLS and proxy:** Caddy, for automatic Let's Encrypt certificates in about four lines.
- **Weather:** NOAA GFS, pulled through the NOMADS filter so only the 10m wind components
  are requested. That is the difference between a few megabytes and a gigabyte per run.
- **Host:** one small VPS, *not* Heroku. Heroku dynos have ephemeral filesystems and cycle
  daily, which destroys both SQLite and the GRIB cache, forcing managed Postgres and
  external storage — roughly $12/month spent fighting the architecture. A VPS with a real
  disk is cheaper and simpler. Hetzner is the value leader, with Vultr, DigitalOcean and
  Netcup in the same territory.

Rough monthly cost, as at September 2026 — worth re-checking, since these drift:

| Item | Monthly |
| --- | --- |
| VPS (2 vCPU, 4GB, 40GB disk) | ~$4-5 |
| Domain, amortised | ~$1 |
| TLS, database, auth, weather data | $0 |
| Backups to R2 or B2, inside free tiers | ~$0 |
| **Total** | **~$5-6** |

That covers several hundred concurrent players comfortably and probably low thousands.

**Do not persist every boat every tick.** A thousand boats written every five seconds is 17
million writes a day, which is the pattern that convinces people they need an expensive
database. Hold the fleet in memory and write on player actions, every few minutes, and on
shutdown. Boat state is deterministic from position, heading, wind and elapsed time, so a
crash costs minutes of simulation rather than data. This one decision is the difference
between a $5 server and a $50 one.

**The daily sched is the only cost that scales with players.** A thousand players receiving
a position report daily is 30,000 emails a month, which breaks every transactional email
free tier (Resend allows 3,000). Cheapest first: make the sched a page people visit, or use
web push, or budget ~$20/month for email once the fleet is large. Build it as a page first.

**Keep the tick in exactly one process.** Running two app instances for redundancy would
have both advancing the same fleet, and boats would sail at double speed. Single writer; if
failover is ever wanted, make it cold.

**What not to add:** Redis, Kubernetes, a message queue, a separate worker tier, managed
Postgres. Each solves a scale problem this project will not have, and keeping the whole
game in one Node process on one small box is what holds the bill at five dollars.
