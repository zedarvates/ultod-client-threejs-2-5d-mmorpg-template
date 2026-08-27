export interface DialogAction {
  label: string;
  callback: () => void;
}

export class DialogBox {
  private el: HTMLElement | null;
  private nameEl: HTMLElement | null;
  private textEl: HTMLElement | null;
  private actionsEl: HTMLElement | null;

  constructor() {
    this.el = typeof document !== 'undefined' ? document.getElementById('dialog-box') : null;
    this.nameEl = typeof document !== 'undefined' ? document.getElementById('dialog-name') : null;
    this.textEl = typeof document !== 'undefined' ? document.getElementById('dialog-text') : null;
    this.actionsEl = typeof document !== 'undefined' ? document.getElementById('dialog-actions') : null;
  }

  show(name: string, text: string, actions: DialogAction[] = []): void {
    if (!this.el || !this.nameEl || !this.textEl || !this.actionsEl) return;
    this.nameEl.textContent = name;
    this.textEl.textContent = text;
    this.actionsEl.innerHTML = '';
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.className = 'dialog-btn';
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        this.hide();
        a.callback();
      });
      this.actionsEl.appendChild(btn);
    }
    if (actions.length === 0) {
      const close = document.createElement('button');
      close.className = 'dialog-btn';
      close.textContent = 'Close';
      close.addEventListener('click', () => this.hide());
      this.actionsEl.appendChild(close);
    }
    this.el.style.display = 'block';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }
}
