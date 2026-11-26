// Game loop for Skyline Courier.
// One job: own the frame — read input, step the flight model, draw, play
// sound — and move between the title, flying, landed and crashed screens.
// The loop also honours ?shot=<name>&seed=<n>, which stages a deterministic
// screenshot scene instead of starting an interactive game.

import { VIEW } from './config.js';
import { freshState, nextSortie, resetWorld, stepWorld, EVENT_CRASHED, EVENT_LANDED, EVENT_RING } from './physics.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { render, SCREEN_CRASHED, SCREEN_LANDED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot'),
    seed: Number(params.get('seed') ?? '1') || 1,
  };
}

function main() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const ctx = canvas.getContext('2d');
  const query = readQuery();
  const state = freshState(query.seed);
  const input = makeInput();
  const audio = makeAudio();
  input.attach(window);
  input.attachPointer(canvas);

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  let screen = SCREEN_TITLE;
  let shotMode = false;
  let last = performance.now();
  let acc = 0;

  // A screenshot scene: stage it once, draw one frame, stop the loop.
  if (query.shot) {
    shotMode = true;
    const staged = stageShot(query.shot, state);
    screen = staged.screen;
    // stageShot leaves state.phase where the scene ended (0 title, 1 flying,
    // 2 landed, 3 crashed); render reads it, so keep it as staged.
    render(ctx, state, screen, 4.2, STEP);
    document.title = `Skyline Courier — shot ${query.shot}`;
    return;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('PointerDown')) {
        audio.unlock();
        resetWorld(state);
        state.phase = 1;
        screen = SCREEN_PLAY;
        setStatus('Flying. Fly through the rings, then land on the runway.');
      }
      render(ctx, state, screen, time, dt);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    if (screen === SCREEN_LANDED) {
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        nextSortie(state);
        screen = SCREEN_PLAY;
        setStatus(`Sortie ${state.sortie}. Fly through the rings, then land.`);
      }
      render(ctx, state, screen, time, dt);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    if (screen === SCREEN_CRASHED) {
      if (input.wasPressed('KeyR') || input.wasPressed('Enter')) {
        resetWorld(state);
        state.phase = 1;
        screen = SCREEN_PLAY;
        setStatus('Flying again.');
      }
      render(ctx, state, screen, time, dt);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    // Flying: fixed-step physics, then draw.
    acc += dt;
    let events = 0;
    while (acc >= STEP) {
      events |= stepWorld(state, input.controls(), STEP);
      acc -= STEP;
    }
    audio.engine(state.throttle, state.speed, state.phase === 1);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_LANDED) audio.land();
    if (events & EVENT_CRASHED) {
      audio.crash();
      screen = SCREEN_CRASHED;
      setStatus(state.message);
    } else if (state.phase === 2) {
      screen = SCREEN_LANDED;
      setStatus(state.message);
    } else if (state.phase === 1 && state.speed < 24 && !state.onGround && Math.random() < 0.02) {
      audio.stall();
    }
    render(ctx, state, SCREEN_PLAY, time, dt);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  setStatus('Skyline Courier. Press Enter to fly.');
  requestAnimationFrame(frame);
}

main();
