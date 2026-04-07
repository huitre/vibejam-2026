const ROLE_COLORS: Record<string, string> = {
  ninja: "#8800cc",
  samurai: "#cc2222",
  shogun: "#ffcc00",
};

export class HUD {
  private container: HTMLDivElement;
  private healthBar: HTMLDivElement;
  private healthFill: HTMLDivElement;
  private healthText: HTMLDivElement;
  private timerLabel: HTMLDivElement;
  private roleIndicator: HTMLDivElement;
  private controlsHelp: HTMLDivElement;
  private debugCoords: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";

    // Health bar (top-left)
    const healthContainer = document.createElement("div");
    healthContainer.style.cssText = "position: absolute; top: 20px; left: 20px;";

    this.roleIndicator = document.createElement("div");
    this.roleIndicator.style.cssText = "font-size: 16px; color: white; margin-bottom: 5px; font-weight: bold; text-shadow: 1px 1px 3px black;";
    healthContainer.appendChild(this.roleIndicator);

    this.healthBar = document.createElement("div");
    this.healthBar.style.cssText = "width: 200px; height: 20px; background: #333; border: 2px solid #666; border-radius: 3px; overflow: hidden;";

    this.healthFill = document.createElement("div");
    this.healthFill.style.cssText = "width: 100%; height: 100%; background: linear-gradient(to right, #cc2222, #22cc22); transition: width 0.2s;";
    this.healthBar.appendChild(this.healthFill);
    healthContainer.appendChild(this.healthBar);

    this.healthText = document.createElement("div");
    this.healthText.style.cssText = "font-size: 14px; color: white; margin-top: 3px; text-shadow: 1px 1px 2px black;";
    healthContainer.appendChild(this.healthText);

    this.container.appendChild(healthContainer);

    // Timer (top-center)
    this.timerLabel = document.createElement("div");
    this.timerLabel.style.cssText = `
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      font-size: 28px; color: white; font-weight: bold;
      text-shadow: 2px 2px 4px black; font-variant-numeric: tabular-nums;
    `;
    this.container.appendChild(this.timerLabel);

    // Controls help (bottom-left)
    this.controlsHelp = document.createElement("div");
    this.controlsHelp.style.cssText = `
      position: absolute; bottom: 20px; left: 20px;
      font-size: 13px; color: #888; line-height: 1.6; text-shadow: 1px 1px 2px black;
    `;
    this.controlsHelp.innerHTML = "WASD - Deplacement | Clic - Attaque<br>Q - Ability 1 | E - Ability 2 | R - Ability 3<br>F - Interagir | T - Changer arme";
    this.container.appendChild(this.controlsHelp);

    // Debug coords (top-right)
    this.debugCoords = document.createElement("div");
    this.debugCoords.style.cssText = `
      position: absolute; top: 20px; right: 20px;
      font-size: 14px; color: #0f0; font-family: monospace;
      text-shadow: 1px 1px 2px black; line-height: 1.5;
    `;
    this.container.appendChild(this.debugCoords);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  setRole(role: string): void {
    const color = ROLE_COLORS[role] || "#fff";
    const name = role.charAt(0).toUpperCase() + role.slice(1);
    this.roleIndicator.innerHTML = `<span style="color:${color}">\u25CF</span> ${name}`;
  }

  updateHealth(hp: number, maxHp: number): void {
    const pct = Math.max(0, (hp / maxHp) * 100);
    this.healthFill.style.width = `${pct}%`;

    // Color from green to red
    const r = Math.round(255 * (1 - pct / 100));
    const g = Math.round(255 * (pct / 100));
    this.healthFill.style.background = `rgb(${r}, ${g}, 50)`;

    this.healthText.textContent = `${hp} / ${maxHp}`;
  }

  updateTimer(seconds: number): void {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    this.timerLabel.textContent = `${min}:${sec.toString().padStart(2, "0")}`;

    // Flash red when under 30 seconds
    this.timerLabel.style.color = seconds < 30 ? "#ff4444" : "white";
  }

  updateDebugCoords(x: number, y: number, z: number, rot: number): void {
    this.debugCoords.textContent = `X: ${x.toFixed(1)}  Z: ${z.toFixed(1)}  Y: ${y.toFixed(1)}\nRot: ${(rot * 180 / Math.PI).toFixed(0)}°`;
  }

  show(): void { this.container.style.display = "block"; }
  hide(): void { this.container.style.display = "none"; }
}
