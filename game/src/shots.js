// Deterministic screenshot scenes for Skyline Courier.
// One job: play the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so each ?shot= frame is
// what a short game really looks like and the same seed always gives the
// same frame. No shot invents a state the game cannot reach.

import { SHOTS, WORLD } from './config.js';
import { stepWorld, EVENT_LANDED, EVENT_CRASHED } from './physics.js';
import { groundHeight, runwayAt } from './terrain.js';
import { SCREEN_CRASHED, SCREEN_LANDED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const STEP = 1 / 60;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Steer toward the next ring, or toward the runway once the rings are done.
 * A proportional controller: it aims the pitch at a target angle instead of
 * holding full up/down, keeps the nose level until flying speed on takeoff,
 * and never aims below the hills ahead plus a safety margin.
 */
function autopilot(state) {
  const target = state.rings[state.ringsHit] ?? null;
  let wantAlt;
  let wantThrottle = 0.85;
  if (target) {
    wantAlt = target.alt;
  } else if (state.runway) {
    wantAlt = 14;
    wantThrottle = state.x > state.runway.start - 500 ? 0.3 : 0.65;
  } else {
    wantAlt = 140;
  }
  // Terrain clearance: never aim below the hills ahead plus a margin.
  // Sample several points ahead — one sample can miss a peak between samples.
  // On final approach the runway is the target, not the hills: the strip is
  // flat, so only the ground just ahead counts, or the plane could never
  // descend to it — it would fly over the strip at terrain-plus-45.
  if (state.runway) {
    // Over the strip itself there is no floor: the plane must descend to
    // the flat surface to touch down at all. Before the strip, keep the
    // ground just ahead clear by a small margin.
    if (runwayAt(state.x)) {
      wantAlt = WORLD.runwayFlat;
    } else {
      let nearMax = -Infinity;
      for (const d of [150, 300]) {
        nearMax = Math.max(nearMax, groundHeight(state.x + d, state.seed));
      }
      wantAlt = Math.max(wantAlt, nearMax + 12);
    }
  } else {
    let aheadMax = -Infinity;
    for (const d of [150, 300, 450, 600, 800]) {
      aheadMax = Math.max(aheadMax, groundHeight(state.x + d, state.seed));
    }
    wantAlt = Math.max(wantAlt, aheadMax + 45);
  }
  // Lining up a ring: inside 400 m, fly the ring itself, keeping only the
  // ground just ahead clear — the far lookahead would hold the plane above
  // the ring and it would fly over it instead of through it.
  if (target && target.x - state.x < 400) {
    const near1 = groundHeight(state.x + 150, state.seed);
    const near2 = groundHeight(state.x + 300, state.seed);
    wantAlt = Math.max(target.alt, near1 + 30, near2 + 30);
  }

  let wantPitch;
  if (state.speed < 30) {
    // Takeoff discipline: stay level until the wing is flying, then climb.
    wantPitch = state.onGround ? 0.05 : -0.15;
    wantThrottle = 1;
  } else {
    const altErr = wantAlt - state.alt;
    if (altErr > 25) wantPitch = 0.35;
    else if (altErr > 8) wantPitch = 0.15;
    else if (altErr < -25) wantPitch = -0.3;
    else if (altErr < -8) wantPitch = -0.12;
    else wantPitch = 0;
    // Never climb steeply while slow.
    if (state.speed < 36 && wantPitch > 0.2) wantPitch = 0.2;
  }
  const pitch = clamp((wantPitch - state.pitch) * 2.5, -1, 1);
  // Hold the course: steer the heading back to 090.
  const rudder = state.heading > 91 ? -1 : state.heading < 89 ? 1 : 0;
  return {
    pitch,
    rudder,
    throttleUp: state.throttle < wantThrottle,
    throttleDown: state.throttle > wantThrottle,
  };
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * Scenes: cover (title, plane parked on the runway), play (mid-flight,
 * chasing a ring), rings (closing on a ring), land (final approach).
 */
export function stageShot(name, state) {
  state.phase = 1;
  state.throttle = 0;
  state.speed = 0;
  state.pitch = 0;
  state.heading = 90;
  if (name === 'cover') {
    state.phase = 0;
    return { screen: SCREEN_TITLE };
  }
  const spec = SHOTS[name] ?? SHOTS.play;
  const steps = Math.round(spec.seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    events = stepWorld(state, autopilot(state), STEP);
    if (events & EVENT_CRASHED) break;
    if (events & EVENT_LANDED) break;
  }
  if (name === 'land' && state.phase === 1) {
    // Keep flying the approach until the runway is close, then hold the frame.
    for (let i = 0; i < 60 * 40; i += 1) {
      const runway = state.runway;
      if (!runway) break;
      if (state.x > runway.start - 260) break;
      events = stepWorld(state, autopilot(state), STEP);
      if (events & (EVENT_CRASHED | EVENT_LANDED)) break;
    }
  }
  if (state.phase === 3) return { screen: SCREEN_CRASHED };
  if (state.phase === 2) return { screen: SCREEN_LANDED };
  // A steady play frame: clear any stale banner so the shot reads clean.
  if (state.time - state.messageAt > 3.5) state.message = '';
  return { screen: SCREEN_PLAY };
}

/** The ground the cover scene stands on, for the title layout. */
export function coverGround(state) {
  return groundHeight(state.x, state.seed);
}
