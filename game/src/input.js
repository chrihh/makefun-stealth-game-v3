// Verdant Vault — keyboard and mouse state for the main loop.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    dx: 0, dy: 0, sneak: false, throwAt: null,
    restart: false, pausePressed: false, mutePressed: false, anyPressed: false,
  };
  let queuedThrow = null;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    input.anyPressed = true;
    if (e.key.toLowerCase() === 'r') input.restart = true;
    if (e.key.toLowerCase() === 'p') input.pausePressed = true;
    if (e.key.toLowerCase() === 'm') input.mutePressed = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    queuedThrow = {
      x: (e.clientX - rect.left) / rect.width * 32,
      y: (e.clientY - rect.top) / rect.height * 18,
    };
    input.anyPressed = true;
  });

  input.poll = () => {
    input.dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    input.dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    input.sneak = keys.has('shift');
    input.throwAt = queuedThrow;
    queuedThrow = null;
    return input;
  };
  input.consume = () => {
    input.restart = false; input.pausePressed = false;
    input.mutePressed = false; input.anyPressed = false;
  };
  return input;
}
