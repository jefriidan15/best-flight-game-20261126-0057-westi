// Canvas rendering for Skyline Courier.
// One job: draw one frame — dusk sky, parallax hills, terrain, river, town,
// runway, rings, the courier plane, particles, the HUD and the screens.
// Everything is drawn with canvas paths; no images, no network.

import { PHYSICS, PLANE, VIEW, WORLD } from './config.js';
import { baseHeight, groundHeight, isRiver, runwayAt, townAt } from './terrain.js';
import { makeRng, noise1 } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_LANDED = 2;
export const SCREEN_CRASHED = 3;

// Metres shown per pixel on screen.
const SCALE = 0.9;
const PLANE_SX = VIEW.width * 0.35;
const PLANE_SY = VIEW.height * 0.55;

const FT = 3.28084;
const KT = 1.94384;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Camera altitude follows the plane smoothly so the frame never jumps. */
function cameraAlt(state, dt) {
  const target = state.alt;
  state._camAlt = state._camAlt === undefined ? target : lerp(state._camAlt, target, Math.min(1, dt * 2.2));
  return state._camAlt;
}

function worldToScreenX(state, wx) {
  return PLANE_SX + (wx - state.x) * SCALE;
}

function worldToScreenY(state, camAlt, alt) {
  return PLANE_SY - (alt - camAlt) * SCALE;
}

function drawSky(ctx, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, '#1b2a52');
  sky.addColorStop(0.45, '#4a4a7d');
  sky.addColorStop(0.72, '#c96f4a');
  sky.addColorStop(1, '#e8a35c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Low sun, setting over the hills.
  const sunX = VIEW.width * 0.78;
  const sunY = VIEW.height * 0.62;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 180);
  glow.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 166, 88, 0.55)');
  glow.addColorStop(1, 'rgba(255, 166, 88, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 190, sunY - 190, 380, 380);
  ctx.fillStyle = '#ffd68c';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  // Early stars, high up.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const rng = makeRng(99);
  for (let i = 0; i < 40; i += 1) {
    const x = rng() * VIEW.width;
    const y = rng() * VIEW.height * 0.3;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.7 + i));
    ctx.globalAlpha = tw * (1 - y / (VIEW.height * 0.35));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // Slow clouds.
  ctx.fillStyle = 'rgba(255, 214, 180, 0.16)';
  for (let i = 0; i < 6; i += 1) {
    const cx = ((i * 260 + time * 6) % (VIEW.width + 320)) - 160;
    const cy = 70 + i * 46;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 120, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 60, cy + 8, 80, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFarHills(ctx, state, camAlt) {
  ctx.fillStyle = '#3a3a5e';
  ctx.beginPath();
  ctx.moveTo(0, VIEW.height);
  for (let sx = 0; sx <= VIEW.width; sx += 16) {
    const wx = state.x + (sx - PLANE_SX) / SCALE / 2.2;
    const h = baseHeight(wx * 0.5, state.seed + 400) * 0.55 + 40;
    const sy = worldToScreenY(state, camAlt, h + 30);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, state, camAlt) {
  const step = 8;
  // Ground body.
  ctx.beginPath();
  ctx.moveTo(0, VIEW.height);
  for (let sx = 0; sx <= VIEW.width; sx += step) {
    const wx = state.x + (sx - PLANE_SX) / SCALE;
    const sy = worldToScreenY(state, camAlt, groundHeight(wx, state.seed));
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, VIEW.height * 0.4, 0, VIEW.height);
  fill.addColorStop(0, '#4a5d3a');
  fill.addColorStop(1, '#232b1c');
  ctx.fillStyle = fill;
  ctx.fill();
  // Grass lip.
  ctx.strokeStyle = '#6d8a4f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let sx = 0; sx <= VIEW.width; sx += step) {
    const wx = state.x + (sx - PLANE_SX) / SCALE;
    const sy = worldToScreenY(state, camAlt, groundHeight(wx, state.seed));
    if (sx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  // River band where the ground dips low.
  ctx.fillStyle = '#3f6d8e';
  for (let sx = 0; sx <= VIEW.width; sx += step) {
    const wx = state.x + (sx - PLANE_SX) / SCALE;
    if (!isRiver(wx, state.seed)) continue;
    const sy = worldToScreenY(state, camAlt, groundHeight(wx, state.seed));
    ctx.fillRect(sx, sy - 4, step + 1, 8);
  }
}

function drawTown(ctx, state, camAlt, time) {
  for (let sx = 0; sx <= VIEW.width; sx += 4) {
    const wx = state.x + (sx - PLANE_SX) / SCALE;
    const town = townAt(wx, state.seed);
    if (!town || Math.abs(wx - town.x) > 2) continue;
    const gy = worldToScreenY(state, camAlt, groundHeight(wx, state.seed));
    const w = 30;
    const h = town.height * SCALE * 1.4;
    ctx.fillStyle = '#2c2620';
    ctx.fillRect(sx - w / 2, gy - h, w, h);
    ctx.fillStyle = '#4a3428';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 3, gy - h);
    ctx.lineTo(sx, gy - h - 12);
    ctx.lineTo(sx + w / 2 + 3, gy - h);
    ctx.closePath();
    ctx.fill();
    if (town.lit) {
      const blink = 0.75 + 0.25 * Math.sin(time * 2 + town.house);
      ctx.fillStyle = `rgba(255, 214, 130, ${blink})`;
      ctx.fillRect(sx - 8, gy - h + 8, 6, 8);
      ctx.fillRect(sx + 3, gy - h + 8, 6, 8);
    }
  }
  // Water tower beside the first town in view.
  const wx0 = state.x - 400;
  const tower = townAt(wx0 + 260, state.seed);
  if (tower) {
    const sx = worldToScreenX(state, tower.x + 260);
    const gy = worldToScreenY(state, camAlt, groundHeight(tower.x + 260, state.seed));
    ctx.strokeStyle = '#1f1a16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - 10, gy);
    ctx.lineTo(sx - 4, gy - 46);
    ctx.moveTo(sx + 10, gy);
    ctx.lineTo(sx + 4, gy - 46);
    ctx.stroke();
    ctx.fillStyle = '#5a6d7d';
    ctx.beginPath();
    ctx.ellipse(sx, gy - 52, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRunway(ctx, state, camAlt, time) {
  for (let sx = 0; sx <= VIEW.width; sx += 6) {
    const wx = state.x + (sx - PLANE_SX) / SCALE;
    const strip = runwayAt(wx);
    if (!strip) continue;
    const gy = worldToScreenY(state, camAlt, WORLD.runwayFlat);
    ctx.fillStyle = '#26262b';
    ctx.fillRect(sx, gy - 3, 7, 6);
    if (Math.floor((wx - strip.start) / 26) % 2 === 0) {
      ctx.fillStyle = '#e8e8d8';
      ctx.fillRect(sx, gy - 1, 4, 2);
    }
    const edge = 0.6 + 0.4 * Math.sin(time * 3 + wx * 0.05);
    ctx.fillStyle = `rgba(120, 255, 140, ${edge})`;
    if (Math.floor(wx / 40) % 2 === 0) ctx.fillRect(sx, gy - 6, 3, 3);
  }
}

function drawRings(ctx, state, camAlt, time) {
  for (const ring of state.rings) {
    if (ring.passed) continue;
    const sx = worldToScreenX(state, ring.x);
    if (sx < -80 || sx > VIEW.width + 20) continue;
    const sy = worldToScreenY(state, camAlt, ring.alt);
    const r = ring.radius * SCALE;
    const pulse = 1 + 0.06 * Math.sin(time * 4 + ring.index);
    const glow = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 1.6);
    glow.addColorStop(0, 'rgba(255, 190, 80, 0.28)');
    glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb84d';
    ctx.lineWidth = 7 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff2cf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RING ${ring.index + 1}`, sx, sy - r - 12);
  }
  // Arrow to the next ring when it is off-screen (not on the title screen).
  const next = state.rings[state.ringsHit];
  if (next && !next.passed && state.phase !== 0) {
    const sx = worldToScreenX(state, next.x);
    if (sx > VIEW.width - 40) {
      const sy = worldToScreenY(state, camAlt, next.alt);
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath();
      ctx.moveTo(VIEW.width - 58, sy - 14);
      ctx.lineTo(VIEW.width - 30, sy);
      ctx.lineTo(VIEW.width - 58, sy + 14);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(next.x - state.x)} m`, VIEW.width - 66, sy + 5);
    }
  }
}

function drawPlane(ctx, state, time) {
  const px = PLANE_SX;
  const py = PLANE_SY;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-state.pitch);
  // Exhaust puffs when the throttle is up.
  if (state.throttle > 0.15 && state.phase === 1) {
    ctx.fillStyle = 'rgba(220, 220, 220, 0.35)';
    for (let i = 0; i < 3; i += 1) {
      const t = (time * 3 + i * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(-52 - t * 34, 4 + Math.sin(i * 9) * 3, 3 + t * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Tail.
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.lineTo(-48, -20);
  ctx.lineTo(-40, -20);
  ctx.lineTo(-26, -4);
  ctx.closePath();
  ctx.fill();
  // Wing (side view: the near wing sweeps down-back).
  ctx.fillStyle = '#e8b23f';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-26, 22);
  ctx.lineTo(-16, 24);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  const body = ctx.createLinearGradient(0, -12, 0, 10);
  body.addColorStop(0, '#f4f6f8');
  body.addColorStop(0.55, '#dfe6ea');
  body.addColorStop(1, '#9fb2bd');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.quadraticCurveTo(-30, -11, 6, -9);
  ctx.quadraticCurveTo(38, -7, 46, 0);
  ctx.quadraticCurveTo(38, 8, 4, 9);
  ctx.quadraticCurveTo(-32, 9, -46, 0);
  ctx.closePath();
  ctx.fill();
  // Courier stripe.
  ctx.fillStyle = '#2f6db3';
  ctx.fillRect(-30, 1, 62, 3);
  // Cockpit glass, lit from inside.
  ctx.fillStyle = '#bfe6ff';
  ctx.beginPath();
  ctx.moveTo(14, -8);
  ctx.quadraticCurveTo(28, -8, 34, -2);
  ctx.lineTo(14, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
  ctx.fillRect(18, -7, 8, 4);
  // Spinning prop.
  const prop = time * 28;
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(48, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48 - Math.cos(prop) * 16, -Math.sin(prop) * 16);
  ctx.lineTo(48 + Math.cos(prop) * 16, Math.sin(prop) * 16);
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(48, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  // Nav lights: red port, green starboard, blinking white tail.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-8, 22, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#35d461';
  ctx.beginPath();
  ctx.arc(10, 6, 3, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 5) > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-48, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(ctx, state) {
  const altFt = Math.round(state.alt * FT);
  const spdKt = Math.round(state.speed * KT);
  const hdg = Math.round(state.heading);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // Top instrument bar.
  ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
  ctx.fillRect(16, 14, 430, 64);
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 14, 430, 64);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('ALT', 30, 22);
  ctx.fillText('SPD', 140, 22);
  ctx.fillText('HDG', 250, 22);
  ctx.fillText('V/S', 350, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`${altFt}`, 30, 42);
  ctx.fillText(`${spdKt}`, 140, 42);
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 250, 42);
  const vs = Math.round(state.vspeed * FT * 60);
  ctx.fillStyle = state.vspeed > 0 ? '#8dff9e' : state.vspeed < 0 ? '#ff9d7a' : '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${vs >= 0 ? '+' : ''}${vs}`, 348, 46);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '11px monospace';
  ctx.fillText('FT', 92, 52);
  ctx.fillText('KT', 202, 52);
  ctx.fillText('FPM', 412, 52);
  // Score block, top right.
  ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
  ctx.fillRect(VIEW.width - 266, 14, 250, 64);
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.5)';
  ctx.strokeRect(VIEW.width - 266, 14, 250, 64);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('SCORE', VIEW.width - 252, 22);
  ctx.fillText('RINGS', VIEW.width - 152, 22);
  ctx.fillText('SORTIE', VIEW.width - 72, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`${state.score}`, VIEW.width - 252, 42);
  ctx.fillText(`${state.ringsHit}/${state.rings.length}`, VIEW.width - 152, 42);
  ctx.fillText(`${state.sortie}`, VIEW.width - 72, 42);
  // Artificial horizon, bottom left.
  const hx = 78;
  const hy = VIEW.height - 78;
  const hr = 52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2f6db3';
  ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-state.pitch * 0.9);
  ctx.translate(0, clamp(state.pitch * 60, -hr, hr));
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-hr, 0, hr * 2, hr);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(-hr, -2, hr * 2, 4);
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = '#dfe6ea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(hx - 18, hy);
  ctx.lineTo(hx, hy - 5);
  ctx.lineTo(hx + 18, hy);
  ctx.lineTo(hx, hy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fd8ff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 8);
  // Throttle + fuel, bottom centre-left.
  const bx = 160;
  const by = VIEW.height - 118;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8ff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('THR', bx, by);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
  ctx.fillRect(bx + 38, by - 2, 150, 14);
  ctx.fillStyle = state.throttle > 0.85 ? '#ff9d7a' : '#8dff9e';
  ctx.fillRect(bx + 40, by, 146 * state.throttle, 10);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('FUEL', bx, by + 26);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
  ctx.fillRect(bx + 38, by + 24, 150, 14);
  ctx.fillStyle = state.fuel < 20 ? '#ff5a4d' : '#ffd23f';
  ctx.fillRect(bx + 40, by + 26, 146 * (state.fuel / 100), 10);
  // Damage bar, only when hurt.
  if (state.damage > 0) {
    ctx.fillStyle = '#ff9d7a';
    ctx.fillText('DMG', bx, by + 52);
    ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
    ctx.fillRect(bx + 38, by + 50, 150, 14);
    ctx.fillStyle = '#ff5a4d';
    ctx.fillRect(bx + 40, by + 52, 146 * (state.damage / 100), 10);
  }
  // Warnings, centre top.
  ctx.textAlign = 'center';
  if (state.phase === 1 && state.speed < PHYSICS.stallSpeed && !state.onGround) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('⚠ STALL — NOSE DOWN, THROTTLE UP', VIEW.width / 2, 96);
  } else if (state.fuel < 20 && state.phase === 1) {
    ctx.fillStyle = '#ffb84d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('LOW FUEL — LAND ON THE RUNWAY', VIEW.width / 2, 96);
  }
  // Transient message.
  if (state.message && state.time - state.messageAt < 3.5) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(state.message, VIEW.width / 2, 140);
  }
  // Mission line.
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'bold 15px sans-serif';
  const mission =
    state.ringsHit < state.rings.length
      ? `MISSION — FLY THROUGH RING ${state.ringsHit + 1} OF ${state.rings.length}`
      : 'MISSION — LAND ON THE RUNWAY AHEAD';
  ctx.fillText(mission, VIEW.width / 2, VIEW.height - 28);
}

function panel(ctx, title, lines, accent) {
  const w = 560;
  const h = 120 + lines.length * 34;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2 - 40;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, VIEW.width / 2, y + 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW.width / 2, y + 100 + i * 34);
  });
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(8, 12, 24, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd68c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SKYLINE COURIER', VIEW.width / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText('A dusk flight over the river valley — rings, fuel, and one runway home.', VIEW.width / 2, 232);
  ctx.font = '19px sans-serif';
  ctx.fillStyle = '#cfe4ff';
  const lines = [
    '↑ / ↓  pitch up and down      ← / →  steer heading',
    'W / S  or SHIFT  throttle up and down      hold CLICK for throttle',
    'Fly through all 8 rings, then land gently on the runway to refuel.',
    'Mind the stall: below 24 m/s the wing stops flying.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW.width / 2, 300 + i * 32);
  });
  ctx.fillStyle = '#8dff9e';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Press ENTER to fly', VIEW.width / 2, 470);
  if (state.best > 0) {
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Best score: ${state.best}`, VIEW.width / 2, 512);
  }
}

/** Draw one frame. `screen` is one of SCREEN_TITLE/PLAY/LANDED/CRASHED. */
export function render(ctx, state, screen, time, dt) {
  const camAlt = cameraAlt(state, dt);
  drawSky(ctx, time);
  drawFarHills(ctx, state, camAlt);
  drawTerrain(ctx, state, camAlt);
  drawTown(ctx, state, camAlt, time);
  drawRunway(ctx, state, camAlt, time);
  drawRings(ctx, state, camAlt, time);
  drawPlane(ctx, state, time);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, state);
    return;
  }
  drawHud(ctx, state);
  if (screen === SCREEN_LANDED) {
    panel(ctx, 'SORTIE COMPLETE', [
      `Score: ${state.score}   •   Rings: ${state.ringsHit}/${state.rings.length}`,
      `Fuel left: ${Math.round(state.fuel)} — refuelled for sortie ${state.sortie + 1}`,
      'Press ENTER for the next sortie',
    ], '#8dff9e');
  } else if (screen === SCREEN_CRASHED) {
    panel(ctx, 'CRASHED', [
      state.message || 'The courier went down.',
      `Score: ${state.score}   •   Best: ${state.best}`,
      'Press R to fly again',
    ], '#ff5a4d');
  }
}
