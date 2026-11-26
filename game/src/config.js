// Skyline Courier — flight-game constants.
// One file, one job: every number the game tunes lives here, so the physics,
// the renderer and the shot stager all agree without magic numbers inline.

export const VIEW = { width: 1280, height: 800 };

export const PHYSICS = {
  gravity: 9.8,
  // Thrust at full throttle, m/s^2.
  thrust: 24,
  // Quadratic drag coefficient: cruise settles where thrust meets drag.
  drag: 0.0085,
  // Below this speed the wing stops flying and the plane sinks.
  stallSpeed: 24,
  // Sink added per m/s under the stall speed.
  stallSink: 0.55,
  // Pitch limits, radians.
  pitchMax: 0.55,
  pitchRate: 1.1,
  // Heading limits: the course is east (090); bank steers off it.
  headingRate: 28,
  headingMaxOff: 38,
  // Fuel: units per second at idle, plus per unit of throttle.
  // A full sortie at cruise throttle costs about 75 units of the 100-unit
  // tank, so the rings' +8 refuel each is a margin, not a requirement.
  fuelIdle: 0.02,
  fuelThrottle: 0.55,
  fuelMax: 100,
  // Wind gusts push the heading around; the pilot corrects with the rudder.
  gustStrength: 6,
  gustChange: 0.4,
};

export const PLANE = {
  // Takeoff roll starts here (metres along the world).
  startX: 120,
  // Speed window for a safe touchdown, m/s.
  landSpeedMin: 18,
  landSpeedMax: 42,
  // Vertical speed at touchdown must be gentler than this, m/s.
  landVsMax: 4.5,
  // A hard hit above this vertical speed damages the airframe.
  hardHitVs: 8,
};

export const WORLD = {
  // Rings per sortie before the runway call.
  ringsPerSortie: 8,
  // First ring stands this far past the runway.
  firstRingX: 950,
  // Rings are spaced roughly this far apart.
  ringGap: 750,
  // Ring altitude stays this far above the ground.
  ringAltMin: 70,
  ringAltMax: 230,
  // Ring radius in metres (the hole the plane must fly through).
  ringRadius: 26,
  // Runways repeat along the world this far apart.
  runwayGap: 6000,
  runwayLength: 340,
  runwayFlat: 8,
};

export const SCORE = {
  ring: 100,
  ringOnCourse: 25,
  landing: 500,
  sortieBonus: 250,
};

export const SHOTS = {
  // Fixed-step autopilot scenes, so a screenshot is the same every run.
  cover: { seconds: 0, horizon: 0.7 },
  play: { seconds: 24, horizon: 0.7 },
  rings: { seconds: 40, horizon: 0.7 },
  // The land scene stages most of a full sortie so the frame is the final
  // approach: the plane descending toward the strip, runway lights ahead.
  land: { seconds: 262, horizon: 0.5 },
};
