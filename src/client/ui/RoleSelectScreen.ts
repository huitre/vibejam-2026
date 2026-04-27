const ROLE_COLORS: Record<string, string> = {
  ninja: "#8800cc",
  samurai: "#cc2222",
  shogun: "#ffcc00",
};

const ROLE_NAMES: Record<string, string> = {
  ninja: "Ninja",
  samurai: "Samourai",
  shogun: "Shogun",
};

const ROLES = ["ninja", "samurai", "shogun"] as const;

export class RoleSelectScreen {
  private container: HTMLDivElement;
  private roleLabel: HTMLDivElement;
  private playerCountLabel: HTMLDivElement;
  private readyBtn: HTMLButtonElement;
  private roleButtons: Map<string, HTMLButtonElement> = new Map();
  private currentRole = "";
  private selectRoleCallback?: (role: string) => void;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7); color: white; font-size: 20px;
    `;

    const title = document.createElement("h1");
    title.textContent = "SAMURAI JAM";
    title.style.cssText = "font-size: 48px; margin-bottom: 20px; color: #ffcc00; text-shadow: 2px 2px 8px rgba(0,0,0,0.8);";
    this.container.appendChild(title);

    this.roleLabel = document.createElement("div");
    this.roleLabel.style.cssText = "font-size: 28px; margin-bottom: 15px;";
    this.container.appendChild(this.roleLabel);

    // Role selection buttons
    const roleRow = document.createElement("div");
    roleRow.style.cssText = "display: flex; gap: 12px; margin-bottom: 20px;";
    for (const role of ROLES) {
      const btn = document.createElement("button");
      btn.textContent = ROLE_NAMES[role];
      btn.style.cssText = `
        padding: 10px 24px; font-size: 18px; font-weight: bold;
        background: rgba(255,255,255,0.08); color: ${ROLE_COLORS[role]};
        border: 2px solid ${ROLE_COLORS[role]}; border-radius: 6px;
        cursor: pointer; letter-spacing: 1px; transition: background 0.15s;
        pointer-events: auto;
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectRoleCallback?.(role);
      });
      roleRow.appendChild(btn);
      this.roleButtons.set(role, btn);
    }
    this.container.appendChild(roleRow);

    this.playerCountLabel = document.createElement("div");
    this.playerCountLabel.textContent = "En attente de joueurs...";
    this.playerCountLabel.style.cssText = "margin-bottom: 30px; color: #aaa;";
    this.container.appendChild(this.playerCountLabel);

    this.readyBtn = document.createElement("button");
    this.readyBtn.textContent = "PRET !";
    this.readyBtn.style.cssText = `
      padding: 12px 40px; font-size: 22px; background: #cc2222; color: white;
      border: 2px solid #ff4444; cursor: pointer; border-radius: 4px;
      font-weight: bold; letter-spacing: 2px; display: none;
      pointer-events: auto;
    `;
    this.container.appendChild(this.readyBtn);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  setRole(role: string): void {
    this.currentRole = role;
    const name = ROLE_NAMES[role] || role;
    const color = ROLE_COLORS[role] || "#fff";
    this.roleLabel.innerHTML = `Ton role : <span style="color:${color}; font-weight:bold;">${name}</span>`;

    // Highlight selected role button
    for (const [r, btn] of this.roleButtons) {
      if (r === role) {
        btn.style.background = ROLE_COLORS[r] + "33";
        btn.style.boxShadow = `0 0 10px ${ROLE_COLORS[r]}55`;
      } else {
        btn.style.background = "rgba(255,255,255,0.08)";
        btn.style.boxShadow = "none";
      }
    }
  }

  setPlayerCount(count: number): void {
    this.playerCountLabel.textContent = `Joueurs connectes : ${count}/10`;
  }

  showReadyButton(): void {
    this.readyBtn.style.display = "";
  }

  hideReadyButton(): void {
    this.readyBtn.style.display = "none";
  }

  onSelectRole(callback: (role: string) => void): void {
    this.selectRoleCallback = callback;
  }

  onReady(callback: () => void): void {
    this.readyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.readyBtn.textContent = "EN ATTENTE...";
      this.readyBtn.disabled = true;
      callback();
    });
  }

  show(): void { this.container.style.display = "flex"; }
  hide(): void { this.container.style.display = "none"; }
}
