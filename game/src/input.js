// input.js — keyboard and mouse drive movement, stance, interaction and gadget use.
// v2 controls: E take the Aurora Prism, Q / left-click throw a coin, S deploy smoke.
// A quick left click throws; holding left still walks toward the cursor.

const HANDLED_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyE', 'KeyR',
  'KeyQ', 'Digit1', 'Digit2', 'Digit3',
]);

export function createInput(canvas, screenToWorld) {
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseHeld = false;
  let leftPress = null;
  let interactQueued = false;
  let coinQueued = false;
  let smokeQueued = false;
  let throwQueued = null;
  let restartQueued = false;
  let levelQueued = null;
  let anyInput = false;

  window.addEventListener('keydown', (event) => {
    if (HANDLED_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'KeyE') interactQueued = true;
      if (event.code === 'KeyQ') coinQueued = true;
      if (event.code === 'KeyS') smokeQueued = true;
      if (event.code === 'KeyR') restartQueued = true;
      if (event.code === 'Digit1') levelQueued = 1;
      if (event.code === 'Digit2') levelQueued = 2;
      if (event.code === 'Digit3') levelQueued = 3;
    }
    pressed.add(event.code);
    anyInput = true;
  });

  window.addEventListener('keyup', (event) => pressed.delete(event.code));
  window.addEventListener('blur', () => {
    pressed.clear();
    mouseHeld = false;
    leftPress = null;
  });

  canvas.addEventListener('mousemove', (event) => {
    const point = screenToWorld(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = screenToWorld(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    if (event.button === 0) {
      mouseHeld = true;
      leftPress = { x: point.x, y: point.y, time: performance.now() };
    }
    if (event.button === 2) throwQueued = { x: point.x, y: point.y };
    anyInput = true;
  });
  canvas.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    const point = screenToWorld(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    mouseHeld = false;
    if (leftPress && performance.now() - leftPress.time < 240) {
      const travel = Math.hypot(point.x - leftPress.x, point.y - leftPress.y);
      if (travel < 14) throwQueued = { x: point.x, y: point.y };
    }
    leftPress = null;
  });
  canvas.addEventListener('mouseleave', () => { mouseHeld = false; leftPress = null; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function readFrame(playerX, playerY) {
    let moveX = 0;
    let moveY = 0;
    if (pressed.has('KeyA') || pressed.has('ArrowLeft')) moveX -= 1;
    if (pressed.has('KeyD') || pressed.has('ArrowRight')) moveX += 1;
    if (pressed.has('KeyW') || pressed.has('ArrowUp')) moveY -= 1;
    if (pressed.has('KeyS') || pressed.has('ArrowDown')) moveY += 1;

    const mouseDistance = Math.hypot(mouseX - playerX, mouseY - playerY);
    if (moveX === 0 && moveY === 0 && mouseHeld && mouseDistance > 8) {
      moveX = (mouseX - playerX) / mouseDistance;
      moveY = (mouseY - playerY) / mouseDistance;
    }

    const frame = {
      moveX,
      moveY,
      run: pressed.has('ShiftLeft') || pressed.has('ShiftRight') || (mouseHeld && mouseDistance > 240),
      crouch: pressed.has('ControlLeft') || pressed.has('ControlRight') || pressed.has('KeyC'),
      interact: interactQueued,
      coin: coinQueued,
      smoke: smokeQueued,
      throwPoint: throwQueued,
      restart: restartQueued,
      levelRequest: levelQueued,
      mouseX,
      mouseY,
      mouseHeld,
    };
    interactQueued = false;
    coinQueued = false;
    smokeQueued = false;
    throwQueued = null;
    restartQueued = false;
    levelQueued = null;
    return frame;
  }

  function consumeAnyInput() {
    const result = anyInput;
    anyInput = false;
    return result;
  }

  return { readFrame, consumeAnyInput };
}
