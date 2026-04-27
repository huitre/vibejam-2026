import type { ScoreEntry } from "./GameOverScreen.js";

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
  private staminaBar: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private timerLabel: HTMLDivElement;
  private roleIndicator: HTMLDivElement;
  private controlsHelp: HTMLDivElement;
  private debugCoords: HTMLDivElement;
  private bombIndicator: HTMLDivElement;
  private torchCounter: HTMLDivElement;
  private ninjaInventory: HTMLDivElement;
  private spectatorOverlay: HTMLDivElement;
  private scoreboardOverlay: HTMLDivElement;
  private blockIndicator: HTMLDivElement;
  private healthContainer: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";

    // Health bar (top-left)
    this.healthContainer = document.createElement("div");
    const healthContainer = this.healthContainer;
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

    this.staminaBar = document.createElement("div");
    this.staminaBar.style.cssText = "width: 200px; height: 12px; background: #333; border: 2px solid #666; border-radius: 3px; overflow: hidden; margin-top: 4px;";

    this.staminaFill = document.createElement("div");
    this.staminaFill.style.cssText = "width: 100%; height: 100%; background: linear-gradient(to right, #0088cc, #00ccff); transition: width 0.2s;";
    this.staminaBar.appendChild(this.staminaFill);
    healthContainer.appendChild(this.staminaBar);

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
    this.controlsHelp.innerHTML = "WASD - Deplacement | Clic - Attaque | Clic droit - Blocage | Shift - Sprint<br>Q - Ability 1 | E - Ability 2 | R - Ability 3<br>C - Caltrops | Space - Dash | F - Interagir | T - Changer arme";
    this.container.appendChild(this.controlsHelp);

    // Debug coords (top-right)
    this.debugCoords = document.createElement("div");
    this.debugCoords.style.cssText = `
      position: absolute; top: 20px; right: 20px;
      font-size: 14px; color: #0f0; font-family: monospace;
      text-shadow: 1px 1px 2px black; line-height: 1.5;
    `;
    this.container.appendChild(this.debugCoords);

    // Bomb selection indicator (bottom-center)
    this.bombIndicator = document.createElement("div");
    this.bombIndicator.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      font-size: 18px; color: white; font-weight: bold;
      text-shadow: 2px 2px 4px black; text-align: center;
      padding: 8px 16px; background: rgba(0,0,0,0.4); border-radius: 6px;
      display: none;
    `;
    this.container.appendChild(this.bombIndicator);

    // Torch counter (below health bar, samurai only)
    this.torchCounter = document.createElement("div");
    this.torchCounter.style.cssText = `
      position: absolute; top: 75px; left: 20px;
      font-size: 15px; color: #ff8833; font-weight: bold;
      text-shadow: 1px 1px 3px black;
      display: none;
    `;
    this.container.appendChild(this.torchCounter);

    // Ninja inventory (below stamina bar, ninja only)
    this.ninjaInventory = document.createElement("div");
    this.ninjaInventory.style.cssText = `
      position: absolute; top: 100px; left: 20px;
      font-size: 14px; color: #ccc; font-weight: bold;
      text-shadow: 1px 1px 3px black; line-height: 1.6;
      display: none;
    `;
    this.container.appendChild(this.ninjaInventory);

    // Spectator overlay (bottom-center)
    this.spectatorOverlay = document.createElement("div");
    this.spectatorOverlay.style.cssText = `
      position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
      font-size: 18px; color: white; font-weight: bold;
      text-shadow: 2px 2px 4px black; text-align: center;
      padding: 10px 24px; background: rgba(0,0,0,0.5); border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      display: none;
    `;
    this.container.appendChild(this.spectatorOverlay);

    // Tab scoreboard overlay (center)
    this.scoreboardOverlay = document.createElement("div");
    this.scoreboardOverlay.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 16px 24px; min-width: 380px;
      pointer-events: none; display: none;
    `;
    this.container.appendChild(this.scoreboardOverlay);

    // Block indicator (left of center)
    this.blockIndicator = document.createElement("div");
    this.blockIndicator.style.cssText = `
      position: absolute; bottom: 140px; left: 50%; transform: translateX(-50%);
      font-size: 20px; color: #66aaff; font-weight: bold;
      text-shadow: 0 0 8px #4488ff, 1px 1px 3px black;
      padding: 6px 18px; background: rgba(0,40,80,0.4); border-radius: 6px;
      border: 1px solid rgba(100,170,255,0.4);
      display: none;
    `;
    this.blockIndicator.textContent = "BLOCAGE";
    this.container.appendChild(this.blockIndicator);

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

  updateStamina(stamina: number, maxStamina: number): void {
    const pct = Math.max(0, (stamina / maxStamina) * 100);
    this.staminaFill.style.width = `${pct}%`;
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

  showBombSelected(kind: string): void {
    const label = kind === "water_bomb" ? "Water Bomb" : "Smoke Bomb";
    const color = kind === "water_bomb" ? "#4488ff" : "#aaaaaa";
    this.bombIndicator.innerHTML = `<span style="color:${color}">[${label} Selected]</span> - Hold Click to Aim`;
    this.bombIndicator.style.display = "block";
  }

  hideBombSelected(): void {
    this.bombIndicator.style.display = "none";
  }

  updateTorchCount(count: number): void {
    this.torchCounter.style.display = "block";
    this.torchCounter.textContent = `\uD83D\uDD25 Torches: ${count}`;
  }

  hideTorchCount(): void {
    this.torchCounter.style.display = "none";
  }

  updateNinjaInventory(
    smokeBombs: number, caltrops: number,
    dashReady: boolean = true, dashCooldownSec: number = 0,
    hasKawariminCheckpoint: boolean = false, kawariminReady: boolean = true, kawariminCooldownSec: number = 0,
  ): void {
    this.ninjaInventory.style.display = "block";
    const dashText = dashReady
      ? `<span style="color:#aa44ff">\u26A1 Dash: Pret</span>`
      : `<span style="color:#666">\u26A1 Dash: ${dashCooldownSec}s</span>`;
    let kawariminText: string;
    if (!kawariminReady) {
      kawariminText = `<span style="color:#666">\uD83E\uDEB5 Kawarimi: ${kawariminCooldownSec}s</span>`;
    } else if (hasKawariminCheckpoint) {
      kawariminText = `<span style="color:#44cc44">\uD83E\uDEB5 Kawarimi: Actif</span>`;
    } else {
      kawariminText = `<span style="color:#aa8844">\uD83E\uDEB5 Kawarimi: Pret</span>`;
    }
    this.ninjaInventory.innerHTML =
      `<span style="color:#aaaaaa">\uD83D\uDCA8 Smoke: ${smokeBombs}</span><br>` +
      `<span style="color:#cc8844">\u26A0 Caltrops: ${caltrops}</span><br>` +
      dashText + `<br>` +
      kawariminText;
  }

  showSpectator(targetRole: string): void {
    const color = ROLE_COLORS[targetRole] || "#fff";
    const name = targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
    this.spectatorOverlay.innerHTML = `Spectateur &mdash; <span style="color:${color}">${name}</span> &mdash; \u2190 \u2192 pour changer`;
    this.spectatorOverlay.style.display = "block";
    // Hide player HUD elements
    this.healthContainer.style.display = "none";
    this.controlsHelp.style.display = "none";
    this.torchCounter.style.display = "none";
    this.ninjaInventory.style.display = "none";
    this.bombIndicator.style.display = "none";
  }

  hideSpectator(): void {
    this.spectatorOverlay.style.display = "none";
    this.healthContainer.style.display = "";
    this.controlsHelp.style.display = "";
  }

  showScoreboardOverlay(players: ScoreEntry[]): void {
    const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    let html = `<div style="font-size: 16px; font-weight: bold; color: #ccc; margin-bottom: 10px; text-align: center;">Scoreboard</div>`;
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 14px; color: white;">`;
    html += `<tr style="border-bottom: 1px solid #555; color: #888;">
      <th style="text-align: left; padding: 4px 8px;">Joueur</th>
      <th style="text-align: left; padding: 4px 8px;">Role</th>
      <th style="text-align: center; padding: 4px 8px;">K</th>
      <th style="text-align: center; padding: 4px 8px;">D</th>
    </tr>`;
    for (const entry of sorted) {
      const roleColor = ROLE_COLORS[entry.role] || "#fff";
      const roleName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
      const opacity = entry.alive ? "1" : "0.5";
      const deadIcon = entry.alive ? "" : " \u2620";
      const isBot = entry.sessionId.startsWith("bot_");
      const name = isBot ? entry.sessionId.replace(/_/g, " ") : entry.sessionId.substring(0, 8);
      html += `<tr style="border-bottom: 1px solid #333; opacity: ${opacity};">
        <td style="padding: 3px 8px;">${name}${deadIcon}</td>
        <td style="padding: 3px 8px; color: ${roleColor};">${roleName}</td>
        <td style="padding: 3px 8px; text-align: center;">${entry.kills}</td>
        <td style="padding: 3px 8px; text-align: center;">${entry.deaths}</td>
      </tr>`;
    }
    html += `</table>`;
    this.scoreboardOverlay.innerHTML = html;
    this.scoreboardOverlay.style.display = "block";
  }

  hideScoreboardOverlay(): void {
    this.scoreboardOverlay.style.display = "none";
  }

  showBlockIndicator(): void {
    this.blockIndicator.style.display = "block";
  }

  hideBlockIndicator(): void {
    this.blockIndicator.style.display = "none";
  }

  show(): void { this.container.style.display = "block"; }
  hide(): void { this.container.style.display = "none"; }
}
