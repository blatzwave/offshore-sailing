# Calculating Position #

To implement a simple method for calculating a new boat position incrementally or when one is requested, there are two options:
+ Desination point given a distance along a [great-circle](https://en.wikipedia.org/wiki/Great_circle) and bearing from a starting point
+ Destination point along a [rhumb line](https://en.wikipedia.org/wiki/Rhumb_line) given a starting point and a constant bearing.

Sailing charts are coneventionally on a [Mercator projection](https://en.wikipedia.org/wiki/Mercator_projection) where a straight line is equivalent to a rhumb line. It allows a navigator to set a constant bearing to a destination point. While not the shortest distance, ists convenience makes common practice.

I believe this should be the method used here.

More infomation below:

## Destination point given distance and bearing from start point ##

Given a start point, initial bearing, and distance, this will calculate the destination point and final bearing travelling along a (shortest distance) great circle arc.

**Formula:**

φ2 = asin( sin φ1 ⋅ cos δ + cos φ1 ⋅ sin δ ⋅ cos θ )λ2 = λ1 + atan2( sin θ ⋅ sin δ ⋅ cos φ1, cos δ − sin φ1 ⋅ sin φ2 )

where φ is latitude, λ is longitude, θ is the bearing (clockwise from north), δ is the angular distance d/R; d being the distance travelled, R the earth’s radius

**JavaScript:**

(all angles in radians)

```javascript
const φ2 = Math.asin( Math.sin(φ1)*Math.cos(d/R) +
Math.cos(φ1)*Math.sin(d/R)*Math.cos(brng) );
const λ2 = λ1 + Math.atan2(Math.sin(brng)*Math.sin(d/R)*Math.cos(φ1),
Math.cos(d/R)-Math.sin(φ1)*Math.sin(φ2));The longitude can be normalised to −180…+180 using (lon+540)%360-180
```
Source: https://www.movable-type.co.uk/scripts/latlong.html

---

## Rhumb lines ##

A ‘rhumb line’ (or loxodrome) is a path of constant bearing, which crosses all meridians at the same angle.

Sailors used to (and sometimes still) navigate along rhumb lines since it is easier to follow a constant compass bearing than to be continually adjusting the bearing, as is needed to follow a great circle. Rhumb lines are straight lines on a Mercator Projec­tion map (also helpful for navigation).

Rhumb lines are generally longer than great-circle (orthodrome) routes. For instance, London to New York is 4% longer along a rhumb line than along a great circle – important for aviation fuel, but not particularly to sailing vessels. New York to Beijing – close to the most extreme example possible (though not sailable!) – is 30% longer along a rhumb line.

Key to calculations of rhumb lines is the inverse Gudermannian function¹, which gives the height on a Mercator projection map of a given latitude: ln(tanφ + secφ) or ln( tan(π/4+φ/2) ). This of course tends to infinity at the poles (in keeping with the Mercator projec­tion). For obsessives, there is even an ellipsoidal version, the ‘isometric latitude’: ψ = ln( tan(π/4+φ/2) / [ (1−e⋅sinφ) / (1+e⋅sinφ) ]e/2), or its better-conditioned equivalent ψ = atanh(sinφ) − e⋅atanh(e⋅sinφ).

The formulas to derive Mercator projection easting and northing coordinates from spherical latitude and longitude are then¹
	E = R ⋅ λ
	N = R ⋅ ln( tan(π/4 + φ/2) )

The following formulas are from Ed Williams’ aviation formulary.¹

## Destination ##

Given a start point and a distance d along constant bearing θ, this will calculate the destination point. If you maintain a constant bearing along a rhumb line, you will gradually spiral in towards one of the poles.

**Formula:**
  
  δ = d/R 	(angular distance)
	φ2 = φ1 + δ ⋅ cos θ 	
	Δψ = ln( tan(π/4 + φ2/2) / tan(π/4 + φ1/2) ) 	(‘projected’ latitude difference)
	q = Δφ/Δψ (or cos φ for E-W line) 	
	Δλ = δ ⋅ sin θ / q 	
	λ2 = λ1 + Δλ 	
  
where 	φ is latitude, λ is longitude, Δλ is taking shortest route (<180°), ln is natural log, R is the earth’s radius

JavaScript:
(all angles in radians)
	
```javascript
const δ = d/R;
const Δφ = δ * Math.cos(θ);
const φ2 = φ1 + Δφ;

const Δψ = Math.log(Math.tan(φ2/2+Math.PI/4)/Math.tan(φ1/2+Math.PI/4));
const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

const Δλ = δ*Math.sin(θ)/q;
const λ2 = λ1 + Δλ;

// check for some daft bugger going past the pole, normalise latitude if so
if (Math.abs(φ2) > Math.PI/2) φ2 = φ2>0 ? Math.PI-φ2 : -Math.PI-φ2;
```

The longitude can be normalised to −180…+180 using (lon+540)%360-180

Source: https://www.movable-type.co.uk/scripts/latlong.html

---

