export class HudOverlay {
  constructor(private el: HTMLElement) {}

  update(status: string, netStatus: string): void {
    this.el.textContent = status + '\n' + netStatus;
  }
}
