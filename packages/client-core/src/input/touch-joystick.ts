import type { MoveIntent } from './types.js';

export class TouchJoystick {
  private activeId: number | null = null;
  private vecX = 0;
  private vecY = 0;

  constructor(private zone: HTMLElement | null, private knob: HTMLElement | null) {
    if (!zone || !knob) return;
    zone.style.display = 'ontouchstart' in window ? 'flex' : 'none';

    zone.addEventListener('pointerdown', (e) => {
      this.activeId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.update(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.activeId) this.update(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.activeId) {
        this.activeId = null;
        this.vecX = 0;
        this.vecY = 0;
        if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
      }
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  }

  sample(): Pick<MoveIntent, 'x' | 'y'> {
    return { x: this.vecX, y: this.vecY };
  }

  private update(clientX: number, clientY: number): void {
    if (!this.zone || !this.knob) return;
    const rect = this.zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / (rect.width / 2);
    let dy = (clientY - cy) / (rect.height / 2);
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));
    this.vecX = dx;
    this.vecY = -dy;
    const maxPx = rect.width / 2 - 24;
    this.knob.style.transform = `translate(${dx * maxPx}px, ${dy * maxPx}px)`;
  }
}
