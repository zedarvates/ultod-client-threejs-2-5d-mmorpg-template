// SPDX-License-Identifier: MIT
// HTML dialog box controller.

export interface DialogAction { label: string; callback: () => void; }

export class DialogBox {
  private el: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private actionsEl: HTMLElement;

  constructor() {
    this.el = document.getElementById("dialog-box")!;
    this.nameEl = document.getElementById("dialog-name")!;
    this.textEl = document.getElementById("dialog-text")!;
    this.actionsEl = document.getElementById("dialog-actions")!;
  }

  show(name: string, text: string, actions: DialogAction[] = []): void {
    this.nameEl.textContent = name;
    this.textEl.textContent = text;
    this.actionsEl.innerHTML = "";
    for (const a of actions) {
      const btn = document.createElement("button");
      btn.className = "dialog-btn";
      btn.textContent = a.label;
      btn.addEventListener("click", () => { this.hide(); a.callback(); });
      this.actionsEl.appendChild(btn);
    }
    if (actions.length === 0) {
      const close = document.createElement("button");
      close.className = "dialog-btn";
      close.textContent = "Close";
      close.addEventListener("click", () => this.hide());
      this.actionsEl.appendChild(close);
    }
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }
}
