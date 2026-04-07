import { DEFAULT_BINDINGS, type KeyBindings } from "./KeyBindings.js";

export class InputManager {
  private keys = new Set<string>();
  private bindings: KeyBindings = DEFAULT_BINDINGS;
  private justPressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener("mousedown", (e) => {
      const btn = e.button === 0 ? "MouseLeft" : e.button === 2 ? "MouseRight" : `Mouse${e.button}`;
      if (!this.keys.has(btn)) {
        this.justPressed.add(btn);
      }
      this.keys.add(btn);
    });
    window.addEventListener("mouseup", (e) => {
      const btn = e.button === 0 ? "MouseLeft" : e.button === 2 ? "MouseRight" : `Mouse${e.button}`;
      this.keys.delete(btn);
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  getMovementDirection(): { dx: number; dz: number } {
    let dx = 0;
    let dz = 0;
    if (this.keys.has(this.bindings.forward)) dz += 1;
    if (this.keys.has(this.bindings.backward)) dz -= 1;
    if (this.keys.has(this.bindings.left)) dx += 1;
    if (this.keys.has(this.bindings.right)) dx -= 1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) { dx /= len; dz /= len; }
    return { dx, dz };
  }

  isPressed(key: string): boolean {
    return this.keys.has(key);
  }

  wasJustPressed(key: string): boolean {
    return this.justPressed.has(key);
  }

  clearJustPressed(): void {
    this.justPressed.clear();
  }

  getBindings(): KeyBindings {
    return this.bindings;
  }
}
