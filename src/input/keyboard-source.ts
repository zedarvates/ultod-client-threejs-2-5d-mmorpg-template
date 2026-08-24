import type { MoveIntent } from './types';

const keyMap: Record<string, { x?: number; y?: number }> = {
  ArrowUp: { y: 1 },
  ArrowDown: { y: -1 },
  ArrowLeft: { x: -1 },
  ArrowRight: { x: 1 },
  KeyW: { y: 1 },
  KeyS: { y: -1 },
  KeyA: { x: -1 },
  KeyD: { x: 1 },
};

export class KeyboardSource {
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => this.pressed.add(e.code));
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code));
    window.addEventListener('blur', () => this.pressed.clear());
  }

  sample(): Pick<MoveIntent, 'x' | 'y' | 'run' | 'interact'> {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const dir = keyMap[code];
      if (!dir) continue;
      x += dir.x ?? 0;
      y += dir.y ?? 0;
    }
    return {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      run: this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'),
      interact: this.pressed.has('KeyE'),
    };
  }
}
