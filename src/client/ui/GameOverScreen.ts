export class GameOverScreen {
  private container: HTMLDivElement;
  private titleLabel: HTMLDivElement;
  private subtitleLabel: HTMLDivElement;
  private returnBtn: HTMLButtonElement;
  private returnCallback: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.8); color: white;
    `;

    this.titleLabel = document.createElement("div");
    this.titleLabel.style.cssText = "font-size: 56px; font-weight: bold; margin-bottom: 20px; text-shadow: 3px 3px 10px black;";
    this.container.appendChild(this.titleLabel);

    this.subtitleLabel = document.createElement("div");
    this.subtitleLabel.style.cssText = "font-size: 24px; color: #aaa; margin-bottom: 30px;";
    this.container.appendChild(this.subtitleLabel);

    this.returnBtn = document.createElement("button");
    this.returnBtn.textContent = "RETOUR AU LOBBY";
    this.returnBtn.style.cssText = `
      padding: 12px 36px; font-size: 20px; background: #2266cc; color: white;
      border: 2px solid #4488ee; cursor: pointer; border-radius: 4px;
      font-weight: bold; letter-spacing: 2px;
    `;
    this.returnBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.returnCallback?.();
    });
    this.container.appendChild(this.returnBtn);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  setWinner(winner: string): void {
    if (winner === "ninja") {
      this.titleLabel.textContent = "LE NINJA GAGNE !";
      this.titleLabel.style.color = "#8800cc";
      this.subtitleLabel.textContent = "Le Shogun a ete assassine.";
    } else {
      this.titleLabel.textContent = "LES DEFENSEURS GAGNENT !";
      this.titleLabel.style.color = "#ffcc00";
      this.subtitleLabel.textContent = "Le Shogun est sauf.";
    }
  }

  onReturn(callback: () => void): void {
    this.returnCallback = callback;
  }

  show(): void { this.container.style.display = "flex"; }
  hide(): void { this.container.style.display = "none"; }
}
