export interface PointerSample {
  x: number;
  y: number;
  click: boolean;
}

/** Click placeholder; real click-to-move pathing arrives with the gameplay gate. */
export class PointerSource {
  private clickQueued = false;

  constructor() {
    window.addEventListener('pointerdown', () => {
      this.clickQueued = true;
    });
  }

  sample(): PointerSample {
    return { x: 0, y: 0, click: this.clickQueued };
  }

  endFrame(): void {
    this.clickQueued = false;
  }
}
