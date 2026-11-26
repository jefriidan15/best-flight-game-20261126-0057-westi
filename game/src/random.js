// Seeded random numbers for Skyline Courier.
// One job: deterministic randomness, so the world, the gusts and the
// screenshots are the same on every run from the same seed.

/** Mulberry32: a small, fast seeded PRNG with a full 32-bit period. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value-noise bump: smooth pseudo-random hills from a seed and a position. */
export function noise1(seed, x) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const h = (n) => {
    let v = (n * 374761393 + seed * 668265263) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return (((v ^ (v >>> 16)) >>> 0) % 10000) / 10000;
  };
  const a = h(xi);
  const b = h(xi + 1);
  const u = xf * xf * (3 - 2 * xf);
  return a + (b - a) * u;
}
