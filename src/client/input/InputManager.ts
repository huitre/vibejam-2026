import { DEFAULT_BINDINGS, type KeyBindings } from "./KeyBindings.js";

export class InputManager {
  private keys = new Set<string>();
  private bindings: KeyBindings = DEFAULT_BINDINGS;
  private justPressed = new Set<string>();
  private justReleased = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Tab") e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      this.justReleased.add(e.code);
    });
    window.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement)?.closest?.(".lil-gui")) return;
      const btn = e.button === 0 ? "MouseLeft" : e.button === 2 ? "MouseRight" : `Mouse${e.button}`;
      if (!this.keys.has(btn)) {
        this.justPressed.add(btn);
      }
      this.keys.add(btn);
    });
    window.addEventListener("mouseup", (e) => {
      if ((e.target as HTMLElement)?.closest?.(".lil-gui")) return;
      const btn = e.button === 0 ? "MouseLeft" : e.button === 2 ? "MouseRight" : `Mouse${e.button}`;
      this.keys.delete(btn);
      this.justReleased.add(btn);
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

  wasJustReleased(key: string): boolean {
    return this.justReleased.has(key);
  }

  clearJustPressed(): void {
    this.justPressed.clear();
    this.justReleased.clear();
  }

  getBindings(): KeyBindings {
    return this.bindings;
  }
}
