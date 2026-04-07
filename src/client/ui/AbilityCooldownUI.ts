export class AbilityCooldownUI {
  private container: HTMLDivElement;
  private slots: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px;
    `;

    parent.appendChild(this.container);
  }

  setAbilities(abilities: Array<{ name: string; key: string; color: string }>): void {
    this.container.innerHTML = "";
    this.slots = [];

    for (const ability of abilities) {
      const slot = document.createElement("div");
      slot.style.cssText = `
        width: 50px; height: 50px; border: 2px solid ${ability.color};
        border-radius: 6px; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6); color: white; font-size: 11px;
        position: relative;
      `;

      const keyLabel = document.createElement("div");
      keyLabel.textContent = ability.key;
      keyLabel.style.cssText = "font-size: 14px; font-weight: bold;";
      slot.appendChild(keyLabel);

      const nameLabel = document.createElement("div");
      nameLabel.textContent = ability.name;
      nameLabel.style.cssText = "font-size: 9px; color: #aaa;";
      slot.appendChild(nameLabel);

      this.container.appendChild(slot);
      this.slots.push(slot);
    }
  }

  setCooldown(index: number, progress: number): void {
    const slot = this.slots[index];
    if (!slot) return;

    if (progress > 0) {
      slot.style.opacity = "0.4";
    } else {
      slot.style.opacity = "1";
    }
  }

  show(): void { this.container.style.display = "flex"; }
  hide(): void { this.container.style.display = "none"; }
}
