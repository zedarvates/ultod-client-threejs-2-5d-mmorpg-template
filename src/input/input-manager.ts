import type { MoveIntent } from './types';
import { KeyboardSource } from './keyboard-source';
import { PointerSource } from './pointer-source';
import { TouchJoystick } from './touch-joystick';

/** Unifies keyboard, pointer and touch inputs into one movement intent per frame. */
export class InputManager {
  private readonly keyboard = new KeyboardSource();
  private readonly pointer = new PointerSource();
  private readonly joystick = new TouchJoystick(
    document.getElementById('joystick-zone') as HTMLElement,
    document.getElementById('joystick-knob') as HTMLElement,
  );

  readIntent(): MoveIntent {
    const kb = this.keyboard.sample();
    const pt = this.pointer.sample();
    const joy = this.joystick.sample();
    return {
      x: clamp(kb.x + pt.x + joy.x),
      y: clamp(kb.y + pt.y + joy.y),
      run: kb.run,
      interact: kb.interact || pt.click,
    };
  }

  endFrame(): void {
    this.pointer.endFrame();
  }
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
