// Keyboard and mouse state for the game. The rest of the game reads plain
// fields (which keys are down, where the mouse is in world units, whether the
// trigger is held) and consumes one-shot key presses for menus and pausing,
// so no other module ever touches a DOM event.

/** World width and height the mouse position is reported in. */
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 640;

/** Keys the game uses; their default browser behaviour (scrolling) is suppressed. */
const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'KeyM', 'KeyR', 'Enter', 'Escape',
]);

/** Attach listeners to the canvas and window; returns the live input state. */
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: WORLD_WIDTH / 2,
    mouseY: WORLD_HEIGHT / 3,
    firing: false,
    clicked: false,
  };

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.firing = false;
  });

  function toWorld(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
  }
  canvas.addEventListener('mousemove', toWorld);
  canvas.addEventListener('mousedown', (event) => {
    toWorld(event);
    if (event.button === 0) {
      input.firing = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.firing = false;
  });

  return input;
}

/** True once per physical press of the given key code; consumes the press. */
export function consumePress(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

/** True once per mouse click since the last call; consumes the click. */
export function consumeClick(input) {
  if (!input.clicked) return false;
  input.clicked = false;
  return true;
}

/** End-of-frame tidy-up: a click nobody consumed does not linger into the next frame. */
export function endFrame(input) {
  input.clicked = false;
  input.pressed.clear();
}
