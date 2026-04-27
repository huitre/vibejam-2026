import { GAME } from "../../shared/constants.js";

export interface ScoreEntry {
  sessionId: string;
  role: string;
  kills: number;
  deaths: number;
  alive: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  ninja: "#8800cc",
  samurai: "#cc2222",
  shogun: "#ffcc00",
};

export class GameOverScreen {
  private container: HTMLDivElement;
  private titleLabel: HTMLDivElement;
  private roundInfo: HTMLDivElement;
  private tableContainer: HTMLDivElement;
  private countdownLabel: HTMLDivElement;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85); color: white;
    `;

    this.titleLabel = document.createElement("div");
    this.titleLabel.style.cssText = "font-size: 48px; font-weight: bold; margin-bottom: 10px; text-shadow: 3px 3px 10px black;";
    this.container.appendChild(this.titleLabel);

    this.roundInfo = document.createElement("div");
    this.roundInfo.style.cssText = "font-size: 20px; color: #aaa; margin-bottom: 24px;";
    this.container.appendChild(this.roundInfo);

    this.tableContainer = document.createElement("div");
    this.tableContainer.style.cssText = "margin-bottom: 24px; min-width: 400px;";
    this.container.appendChild(this.tableContainer);

    this.countdownLabel = document.createElement("div");
    this.countdownLabel.style.cssText = "font-size: 18px; color: #888; font-style: italic;";
    this.container.appendChild(this.countdownLabel);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  setScoreboard(winner: string, round: number, ninjaWins: number, defenderWins: number, players: ScoreEntry[]): void {
    // Title
    if (winner === "ninja") {
      this.titleLabel.textContent = "LE NINJA GAGNE !";
      this.titleLabel.style.color = "#8800cc";
    } else {
      this.titleLabel.textContent = "LES DEFENSEURS GAGNENT !";
      this.titleLabel.style.color = "#ffcc00";
    }

    // Round info
    this.roundInfo.textContent = `Round ${round} — Ninja: ${ninjaWins} | Defenseurs: ${defenderWins}`;

    // Build scoreboard table
    const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    this.tableContainer.innerHTML = "";

    const table = document.createElement("table");
    table.style.cssText = "width: 100%; border-collapse: collapse; font-size: 16px;";

    // Header
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr style="border-bottom: 2px solid #555; color: #888;">
      <th style="text-align: left; padding: 8px 12px;">Joueur</th>
      <th style="text-align: left; padding: 8px 12px;">Role</th>
      <th style="text-align: center; padding: 8px 12px;">Kills</th>
      <th style="text-align: center; padding: 8px 12px;">Deaths</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const entry of sorted) {
      const roleColor = ROLE_COLORS[entry.role] || "#fff";
      const roleName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
      const opacity = entry.alive ? "1" : "0.5";
      const deadIcon = entry.alive ? "" : " \u2620";
      const isBot = entry.sessionId.startsWith("bot_");
      const nameDisplay = isBot ? entry.sessionId.replace(/_/g, " ") : entry.sessionId.substring(0, 8);

      const row = document.createElement("tr");
      row.style.cssText = `border-bottom: 1px solid #333; opacity: ${opacity};`;
      row.innerHTML = `
        <td style="padding: 6px 12px;">${nameDisplay}${deadIcon}</td>
        <td style="padding: 6px 12px; color: ${roleColor};">${roleName}</td>
        <td style="padding: 6px 12px; text-align: center;">${entry.kills}</td>
        <td style="padding: 6px 12px; text-align: center;">${entry.deaths}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    this.tableContainer.appendChild(table);

    // Start countdown
    this.startCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    let remaining = Math.ceil(GAME.ROUND_RESTART_DELAY_MS / 1000);
    this.countdownLabel.textContent = `Prochain round dans ${remaining}...`;
    this.countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        this.countdownLabel.textContent = "C'est parti !";
        this.stopCountdown();
      } else {
        this.countdownLabel.textContent = `Prochain round dans ${remaining}...`;
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  show(): void { this.container.style.display = "flex"; }
  hide(): void {
    this.container.style.display = "none";
    this.stopCountdown();
  }
}
