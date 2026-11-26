// Keyboard and mouse input for Skyline Courier.
// One job: turn keys and the pointer into the control object the flight
// model reads — pitch, rudder, throttle — and report single presses
// (start, restart, pause) to the game loop.

export function makeInput() {
  const keys = new Set();
  const input = {
    keys,
    // Held: click-and-hold on the canvas feeds the throttle.
    mouseThrottle: false,
    // One-shot presses, consumed by the loop each frame.
    pressed: new Set(),
    attach(target) {
      target.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        keys.add(event.code);
        input.pressed.add(event.code);
        if (
          event.code === 'ArrowUp' ||
          event.code === 'ArrowDown' ||
          event.code === 'ArrowLeft' ||
          event.code === 'ArrowRight' ||
          event.code === 'Space'
        ) {
          event.preventDefault();
        }
      });
      target.addEventListener('keyup', (event) => {
        keys.delete(event.code);
      });
      target.addEventListener('blur', () => keys.clear());
    },
    attachPointer(canvas) {
      canvas.addEventListener('pointerdown', (event) => {
        input.mouseThrottle = true;
        input.pressed.add('PointerDown');
        event.preventDefault();
      });
      const release = () => {
        input.mouseThrottle = false;
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('pointerleave', release);
    },
    /** The control frame for this step: -1, 0 or 1 per axis. */
    controls() {
      const up = keys.has('ArrowUp') || keys.has('KeyW');
      const down = keys.has('ArrowDown') || keys.has('KeyS');
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      const throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal') || input.mouseThrottle;
      const throttleDown = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus');
      return {
        pitch: (up ? 1 : 0) - (down ? 1 : 0),
        rudder: (right ? 1 : 0) - (left ? 1 : 0),
        throttleUp,
        throttleDown,
      };
    },
    /** True once when the key was pressed since the last check. */
    wasPressed(code) {
      if (input.pressed.has(code)) {
        input.pressed.delete(code);
        return true;
      }
      return false;
    },
    endFrame() {
      input.pressed.clear();
    },
  };
  return input;
}
