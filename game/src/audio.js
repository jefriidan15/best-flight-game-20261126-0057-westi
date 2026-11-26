// Synthesised sound for Skyline Courier.
// One job: every sound the game makes, built from WebAudio oscillators —
// no audio files, no network. Engine hum follows the throttle, a chime
// marks a ring, a thud marks a crash, a soft tone marks a landing.

export function makeAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let master = null;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    /** Call from a user gesture; browsers block audio before one. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') void ctx.resume();
    },
    /** Engine hum follows throttle (0..1) and speed. */
    engine(throttle, speed, flying) {
      if (!ctx || !engine) return;
      const target = flying ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
      engine.frequency.setTargetAtTime(48 + throttle * 46 + speed * 0.35, ctx.currentTime, 0.1);
    },
    ring() {
      tone(880, 0.22, 'sine', 0.25);
      tone(1318, 0.3, 'sine', 0.22, 0.09);
    },
    land() {
      tone(523, 0.25, 'sine', 0.25);
      tone(659, 0.25, 'sine', 0.25, 0.12);
      tone(784, 0.4, 'sine', 0.25, 0.24);
    },
    crash() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      noise.connect(gain);
      gain.connect(master);
      noise.start(t0);
      tone(70, 0.5, 'sine', 0.4);
    },
    stall() {
      tone(220, 0.18, 'square', 0.08);
    },
  };
}
