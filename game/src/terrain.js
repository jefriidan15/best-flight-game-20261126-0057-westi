// Terrain, towns, runways and rings for Skyline Courier.
// One job: answer "what is the ground doing at world-x?" — height, river,
// town, runway — and lay out the rings of a sortie. Pure functions of x
// plus the sortie seed, so the world is the same every time it is built.

import { WORLD } from './config.js';
import { noise1 } from './random.js';

/** Rolling hills: layered sines plus seeded value noise, in metres. */
export function baseHeight(x, seed) {
  const rolling =
    42 +
    30 * Math.sin(x * 0.00042 + seed * 0.13) +
    16 * Math.sin(x * 0.00131 + seed * 0.71) +
    10 * Math.sin(x * 0.0031 + seed * 1.7);
  const bumps = (noise1(seed, x * 0.004) - 0.5) * 26;
  return Math.max(6, rolling + bumps);
}

/** A river carves a low blue band where the hills dip under 14 m. */
export function isRiver(x, seed) {
  return baseHeight(x, seed) < 14;
}

/** Runway strips repeat along the world; each one flattens the ground. */
export function runwayAt(x) {
  const gap = WORLD.runwayGap;
  const index = Math.floor(x / gap);
  const start = index * gap + 400;
  if (x >= start && x <= start + WORLD.runwayLength) {
    return { index, start, end: start + WORLD.runwayLength };
  }
  return null;
}

/** Ground height with the runway shelf cut flat. */
export function groundHeight(x, seed) {
  const runway = runwayAt(x);
  if (runway) return WORLD.runwayFlat;
  return baseHeight(x, seed);
}

/** A town grows beside every runway: houses, lights, a water tower. */
export function townAt(x, seed) {
  const gap = WORLD.runwayGap;
  const index = Math.floor(x / gap);
  const start = index * gap + 400 + WORLD.runwayLength + 60;
  if (x < start || x > start + 520) return null;
  const local = x - start;
  // Houses every ~46 m, seeded heights and lit windows.
  const house = Math.floor(local / 46);
  const hx = start + house * 46;
  const hh = 14 + noise1(seed + index * 7, house * 3.1) * 12;
  const lit = noise1(seed + 91, house * 1.7) > 0.45;
  return { index, house, x: hx, height: hh, lit };
}

/** Build the ring course for one sortie starting past `fromX`. */
export function buildRings(fromX, seed) {
  const rings = [];
  let x = fromX + WORLD.firstRingX;
  for (let i = 0; i < WORLD.ringsPerSortie; i += 1) {
    // A ring must be flyable where it stands: at least 45 m above the
    // ground under it (the ring's own radius is 28 m), and never above the
    // ceiling. The altitude is seeded, so the same sortie always lays the
    // same course.
    const ground = groundHeight(x, seed);
    const alt = Math.min(
      WORLD.ringAltMax,
      Math.max(WORLD.ringAltMin, ground + 45) +
        noise1(seed + 500 + i * 13, i * 2.7) * 80,
    );
    rings.push({ x, alt, radius: WORLD.ringRadius, passed: false, index: i });
    x += WORLD.ringGap + noise1(seed + 900 + i * 5, i) * 220;
  }
  return rings;
}

/** The runway a sortie ends on: the first strip past the last ring. */
export function landingRunway(rings) {
  const lastX = rings[rings.length - 1].x;
  const gap = WORLD.runwayGap;
  const index = Math.floor(lastX / gap) + 1;
  const start = index * gap + 400;
  return { index, start, end: start + WORLD.runwayLength };
}
