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

export class RoleSelectScreen {
  private container: HTMLDivElement;
  private roleLabel: HTMLDivElement;
  private playerCountLabel: HTMLDivElement;
  private readyBtn: HTMLButtonElement;

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

    this.playerCountLabel = document.createElement("div");
    this.playerCountLabel.textContent = "En attente de joueurs...";
    this.playerCountLabel.style.cssText = "margin-bottom: 30px; color: #aaa;";
    this.container.appendChild(this.playerCountLabel);

    this.readyBtn = document.createElement("button");
    this.readyBtn.textContent = "PRET !";
    this.readyBtn.style.cssText = `
      padding: 12px 40px; font-size: 22px; background: #cc2222; color: white;
      border: 2px solid #ff4444; cursor: pointer; border-radius: 4px;
      font-weight: bold; letter-spacing: 2px;
    `;
    this.container.appendChild(this.readyBtn);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  setRole(role: string): void {
    const name = ROLE_NAMES[role] || role;
    const color = ROLE_COLORS[role] || "#fff";
    this.roleLabel.innerHTML = `Ton role : <span style="color:${color}; font-weight:bold;">${name}</span>`;
  }

  setPlayerCount(count: number): void {
    this.playerCountLabel.textContent = `Joueurs connectes : ${count}/10`;
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
