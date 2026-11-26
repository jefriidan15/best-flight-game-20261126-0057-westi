// Flight model for Skyline Courier.
// One job: move the plane one fixed step — throttle, pitch, heading, lift,
// drag, stall, fuel, wind, rings, runway, crash — and say what happened.

import { PHYSICS, PLANE, SCORE, WORLD } from './config.js';
import { buildRings, groundHeight, landingRunway, runwayAt } from './terrain.js';
import { makeRng } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_SORTIE = 8;
export const EVENT_FUEL_EMPTY = 16;

export function freshState(seed) {
  return {
    seed,
    // Metres along the world, metres above sea level, m/s, radians, degrees.
    x: PLANE.startX,
    alt: WORLD.runwayFlat + 2,
    speed: 0,
    pitch: 0,
    heading: 90,
    throttle: 0,
    fuel: PHYSICS.fuelMax,
    damage: 0,
    score: 0,
    ringsHit: 0,
    sortie: 1,
    time: 0,
    // 0 title, 1 flying, 2 landed, 3 crashed.
    phase: 0,
    message: '',
    messageAt: 0,
    gust: 0,
    gustTarget: 0,
    gustTimer: 0,
    rings: buildRings(PLANE.startX, seed),
    runway: null,
    best: 0,
    vspeed: 0,
    onGround: true,
  };
}

export function resetWorld(state) {
  const fresh = freshState(state.seed);
  fresh.best = state.best;
  Object.assign(state, fresh);
}

/** Steer the plane for one step. `ctl` is { pitch, rudder, throttleUp, throttleDown }. */
export function stepWorld(state, ctl, dt) {
  if (state.phase !== 1) return EVENT_NONE;
  const rng = state._rng ?? (state._rng = makeRng(state.seed + 77));
  let events = EVENT_NONE;
  state.time += dt;

  // --- wind gusts wander and push the heading around ---
  state.gustTimer -= dt;
  if (state.gustTimer <= 0) {
    state.gustTarget = (rng() - 0.5) * 2 * PHYSICS.gustStrength;
    state.gustTimer = 1 / PHYSICS.gustChange + rng() * 2;
  }
  state.gust += (state.gustTarget - state.gust) * Math.min(1, dt * 0.8);

  // --- controls ---
  if (ctl.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.7);
  if (ctl.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.7);
  if (state.fuel <= 0) {
    state.throttle = 0;
    events |= EVENT_FUEL_EMPTY;
  }
  state.pitch += ctl.pitch * PHYSICS.pitchRate * dt;
  state.pitch = Math.max(-PHYSICS.pitchMax, Math.min(PHYSICS.pitchMax, state.pitch));
  state.heading += ctl.rudder * PHYSICS.headingRate * dt + state.gust * dt;
  const off = state.heading - 90;
  if (off > PHYSICS.headingMaxOff) state.heading = 90 + PHYSICS.headingMaxOff;
  if (off < -PHYSICS.headingMaxOff) state.heading = 90 - PHYSICS.headingMaxOff;

  // --- thrust, drag, gravity along the flight path ---
  const thrust = state.throttle * PHYSICS.thrust;
  const drag = PHYSICS.drag * state.speed * state.speed;
  state.speed += (thrust - drag - PHYSICS.gravity * Math.sin(state.pitch) * 0.35) * dt;
  if (state.speed < 0) state.speed = 0;

  // --- lift, stall sink, and motion ---
  let vspeed = state.speed * Math.sin(state.pitch);
  if (state.speed < PHYSICS.stallSpeed) {
    vspeed -= (PHYSICS.stallSpeed - state.speed) * PHYSICS.stallSink;
  }
  if (state.onGround) {
    // Rolling on the ground: the wheels hold the plane up, so the stall
    // sink does not drag it into the dirt. Lift-off needs flying speed
    // (stall + 6) and a raised nose; until then the plane stays on the
    // ground and the contact block below clamps it to the terrain.
    if (state.speed > PHYSICS.stallSpeed + 6 && state.pitch > 0.08) {
      state.onGround = false;
    } else {
      vspeed = 0;
    }
  }
  state.vspeed = vspeed;
  const offRad = ((state.heading - 90) * Math.PI) / 180;
  const groundSpeed = state.speed * Math.cos(state.pitch) * Math.cos(offRad);
  state.x += groundSpeed * dt;
  state.alt += vspeed * dt;

  // --- fuel ---
  state.fuel -= (PHYSICS.fuelIdle + state.throttle * PHYSICS.fuelThrottle) * dt;
  if (state.fuel < 0) state.fuel = 0;

  // --- rings: fly through the hoop ---
  const ring = state.rings[state.ringsHit];
  if (ring && !ring.passed) {
    const prevX = state.x - groundSpeed * dt;
    const crossed = prevX < ring.x && state.x >= ring.x;
    if (crossed) {
      const dy = Math.abs(state.alt - ring.alt);
      if (dy <= ring.radius) {
        ring.passed = true;
        state.ringsHit += 1;
        const onCourse = Math.abs(state.heading - 90) <= 10;
        const gained = SCORE.ring + (onCourse ? SCORE.ringOnCourse : 0);
        state.score += gained;
        state.fuel = Math.min(PHYSICS.fuelMax, state.fuel + 8);
        state.message = onCourse
          ? `RING ${state.ringsHit} +${gained} — ON COURSE`
          : `RING ${state.ringsHit} +${gained}`;
        state.messageAt = state.time;
        events |= EVENT_RING;
        if (state.ringsHit >= state.rings.length && !state.runway) {
          state.runway = landingRunway(state.rings);
          state.message = 'ALL RINGS — LAND ON THE RUNWAY AHEAD';
          state.messageAt = state.time;
        }
      }
    }
  }

  // --- ground contact ---
  const ground = groundHeight(state.x, state.seed);
  if (state.alt <= ground + 1.5) {
    state.alt = ground + 1.5;
    const strip = state.runway ?? runwayAt(state.x);
    const onStrip =
      strip && state.x >= strip.start && state.x <= strip.end;
    const gentle = Math.abs(vspeed) <= PLANE.landVsMax;
    const inWindow =
      state.speed >= PLANE.landSpeedMin && state.speed <= PLANE.landSpeedMax;
    if (onStrip && gentle && inWindow && state.phase === 1) {
      // Touchdown: a sortie done, refuel, next sortie faster.
      state.phase = 2;
      const bonus = SCORE.landing + Math.round(state.fuel) + SCORE.sortieBonus;
      state.score += bonus;
      state.message = `LANDED +${bonus} — SORTIE ${state.sortie} COMPLETE`;
      state.messageAt = state.time;
      events |= EVENT_LANDED | EVENT_SORTIE;
      state.best = Math.max(state.best, state.score);
    } else if (state.speed < 12) {
      // Slow ground contact is a roll, not a crash: taxi on, throttle up,
      // and take off again. The plane follows the ground while it rolls.
      state.onGround = true;
      state.speed *= 0.98;
    } else if (Math.abs(vspeed) <= 6 && state.speed <= PLANE.landSpeedMax) {
      // A gentle touch: the plane rolls on, undamaged, and can lift again.
      // The pitch is kept, so a fast plane can lift off again at once.
      state.onGround = true;
      state.vspeed = 0;
    } else if (Math.abs(vspeed) > PLANE.hardHitVs || state.speed > PLANE.landSpeedMax) {
      state.phase = 3;
      state.damage = 100;
      state.message =
        state.fuel <= 0 ? 'OUT OF FUEL — CRASHED' : 'CRASHED INTO THE TERRAIN';
      state.messageAt = state.time;
      events |= EVENT_CRASHED;
      state.best = Math.max(state.best, state.score);
    } else {
      // A rough bounce: damage, but the plane keeps flying if it has speed.
      // Damage is throttled to one hit per 1.5 s so a bumpy ridge cannot
      // stack a dozen hits into a crash in a single second.
      if (state.time - (state._lastBounce ?? -99) > 1.5) {
        state.damage = Math.min(100, state.damage + 5);
        state._lastBounce = state.time;
        state.message = 'ROUGH TOUCH — DAMAGE +5';
        state.messageAt = state.time;
      }
      state.speed *= 0.85;
      state.pitch = 0.15;
      state.alt = ground + 8;
      if (state.damage >= 100) {
        state.phase = 3;
        events |= EVENT_CRASHED;
        state.best = Math.max(state.best, state.score);
      }
    }
  } else {
    state.onGround = false;
  }

  // --- fuel out with no speed left ends the flight ---
  // On the ground or in the air: with no fuel and no speed, the sortie is
  // over. A landing on the strip is caught by the contact block first.
  if (state.fuel <= 0 && state.speed < 4 && state.phase === 1) {
    state.phase = 3;
    state.message = 'OUT OF FUEL — DITCHED';
    state.messageAt = state.time;
    events |= EVENT_CRASHED;
    state.best = Math.max(state.best, state.score);
  }
  return events;
}

/** Start the next sortie from the runway the last one ended on. */
export function nextSortie(state) {
  const strip = state.runway;
  const keepBest = state.best;
  const keepScore = state.score;
  const keepSortie = state.sortie + 1;
  const seed = state.seed + 31;
  const fresh = freshState(seed);
  fresh.best = keepBest;
  fresh.score = keepScore;
  fresh.sortie = keepSortie;
  fresh.phase = 1;
  if (strip) {
    fresh.x = strip.start + 10;
    fresh.alt = WORLD.runwayFlat + 2;
    fresh.onGround = true;
  }
  Object.assign(state, fresh);
  state._rng = makeRng(seed + 77);
}
