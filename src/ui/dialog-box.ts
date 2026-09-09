// SPDX-License-Identifier: MIT
// HTML dialog box controller.

export interface DialogAction { label: string; callback: () => void; }

export class DialogBox {
  private el: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private actionsEl: HTMLElement;
  private returnFocus: HTMLElement | null = null;
  private inertSiblings: HTMLElement[] = [];

  constructor() {
    this.el = document.getElementById("dialog-box")!;
    this.nameEl = document.getElementById("dialog-name")!;
    this.textEl = document.getElementById("dialog-text")!;
    this.actionsEl = document.getElementById("dialog-actions")!;
    document.addEventListener("keydown", (event) => {
      if (!this.isOpen()) return;
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        this.hide();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        this.actionsEl.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      if (controls.length === 0) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (!this.el.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  isOpen(): boolean {
    return this.el.style.display === "block";
  }

  show(name: string, text: string, actions: DialogAction[] = []): void {
    this.returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.inertSiblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement => (
        element instanceof HTMLElement && element !== this.el && !element.inert
      ),
    );
    for (const sibling of this.inertSiblings) sibling.inert = true;
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
    this.actionsEl.querySelector<HTMLButtonElement>("button")?.focus();
  }

  hide(): void {
    const focusTarget = this.returnFocus;
    this.returnFocus = null;
    this.el.style.display = "none";
    for (const sibling of this.inertSiblings) sibling.inert = false;
    this.inertSiblings = [];
    if (focusTarget?.isConnected) focusTarget.focus();
  }
}
