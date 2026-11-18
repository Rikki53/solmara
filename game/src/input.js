// Solmara input controller: handles keyboard, mouse orbit deltas, and pointer locking.

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Map();
    this.pressed = new Set();
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.isPointerLocked = false;
    this.isMouseDown = false;
    this.prevMouseX = 0;
    this.prevMouseY = 0;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && this.canvas.requestPointerLock) {
        this.canvas.requestPointerLock();
      }
    });
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
  }

  mapKeyCode(code) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        return 'forward';
      case 'KeyS':
      case 'ArrowDown':
        return 'backward';
      case 'KeyA':
      case 'ArrowLeft':
        return 'left';
      case 'KeyD':
      case 'ArrowRight':
        return 'right';
      case 'ShiftLeft':
      case 'ShiftRight':
        return 'sprint';
      case 'Space':
        return 'space';
      case 'KeyE':
        return 'enterExit';
      case 'KeyF':
        return 'action';
      case 'KeyH':
        return 'horn';
      case 'KeyC':
        return 'camera';
      case 'KeyM':
        return 'mute';
      case 'KeyP':
      case 'Escape':
        return 'pause';
      default:
        return code.toLowerCase();
    }
  }

  onKeyDown(e) {
    const action = this.mapKeyCode(e.code);
    if (!this.keys.get(action)) {
      this.pressed.add(action);
    }
    this.keys.set(action, true);

    // Prevent default browser scrolling on space / arrow keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  onKeyUp(e) {
    const action = this.mapKeyCode(e.code);
    this.keys.set(action, false);
  }

  onMouseDown(e) {
    this.isMouseDown = true;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;
  }

  onMouseUp() {
    this.isMouseDown = false;
  }

  onMouseMove(e) {
    if (this.isPointerLocked) {
      this.mouseDx += e.movementX || 0;
      this.mouseDy += e.movementY || 0;
    } else if (this.isMouseDown) {
      // Allow drag orbit even if pointer lock isn't active
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;
      this.mouseDx += dx;
      this.mouseDy += dy;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    }
  }

  isDown(action) {
    return !!this.keys.get(action);
  }

  justPressed(action) {
    return this.pressed.has(action);
  }

  consumeMouseDeltas() {
    const deltas = { dx: this.mouseDx, dy: this.mouseDy };
    this.mouseDx = 0;
    this.mouseDy = 0;
    return deltas;
  }

  clearPressed() {
    this.pressed.clear();
  }
}
