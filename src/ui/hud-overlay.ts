export class HudOverlay {
  constructor(
    private el: HTMLElement,
    private statusEl?: HTMLElement,
  ) {}

  update(status: string, netStatus: string): void {
    const visualStatus = status + '\n' + netStatus;
    if (this.el.textContent !== visualStatus) this.el.textContent = visualStatus;
    if (this.statusEl && this.statusEl.textContent !== netStatus) {
      this.statusEl.textContent = netStatus;
    }
  }
}
