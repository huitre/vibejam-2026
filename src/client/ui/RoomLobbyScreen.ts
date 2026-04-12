import { GAME } from "../../shared/constants.js";
import { SamuraiJamRoomMetadata } from "../../shared/types.js";

interface RoomListItem {
  roomId: string;
  metadata: SamuraiJamRoomMetadata;
  clients: number;
  maxClients: number;
}

const PHASE_LABELS: Record<string, { text: string; color: string }> = {
  lobby: { text: "En attente", color: "#44cc44" },
  playing: { text: "En cours", color: "#cccc44" },
  finished: { text: "Termine", color: "#cc4444" },
};

export class RoomLobbyScreen {
  private container: HTMLDivElement;
  private listContainer: HTMLDivElement;
  private createCallback: (() => void) | null = null;
  private joinCallback: ((roomId: string) => void) | null = null;
  private quickPlayCallback: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85); color: white; font-family: sans-serif;
    `;

    // Title
    const title = document.createElement("h1");
    title.textContent = "SAMURAI JAM";
    title.style.cssText = "font-size: 56px; margin: 0 0 8px 0; color: #ffcc00; text-shadow: 3px 3px 10px rgba(0,0,0,0.8); letter-spacing: 4px;";
    this.container.appendChild(title);

    // Subtitle
    const subtitle = document.createElement("div");
    subtitle.textContent = "Choisis un dojo";
    subtitle.style.cssText = "font-size: 20px; color: #aaa; margin-bottom: 24px;";
    this.container.appendChild(subtitle);

    // Button row
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 16px; margin-bottom: 20px;";

    const createBtn = this.makeButton("CREER UN DOJO", "#cc2222", "#ff4444");
    createBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.createCallback?.();
    });
    btnRow.appendChild(createBtn);

    const quickBtn = this.makeButton("PARTIE RAPIDE", "#22aa22", "#44cc44");
    quickBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.quickPlayCallback?.();
    });
    btnRow.appendChild(quickBtn);

    this.container.appendChild(btnRow);

    // Room list wrapper
    const listWrapper = document.createElement("div");
    listWrapper.style.cssText = `
      width: 500px; max-height: 400px; overflow-y: auto;
      background: rgba(0,0,0,0.5); border: 1px solid #444; border-radius: 6px;
    `;

    // Header row
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex; padding: 10px 12px; border-bottom: 1px solid #555;
      font-weight: bold; font-size: 14px; color: #aaa;
    `;
    header.innerHTML = `
      <span style="flex:2">Nom</span>
      <span style="flex:1;text-align:center">Joueurs</span>
      <span style="flex:1;text-align:center">Phase</span>
      <span style="flex:1;text-align:center"></span>
    `;
    listWrapper.appendChild(header);

    this.listContainer = document.createElement("div");
    listWrapper.appendChild(this.listContainer);

    this.container.appendChild(listWrapper);

    // Empty state
    const emptyMsg = document.createElement("div");
    emptyMsg.style.cssText = "color: #666; font-size: 14px; margin-top: 12px;";
    emptyMsg.textContent = "Aucun dojo disponible — cree le tien !";
    emptyMsg.id = "lobby-empty-msg";
    this.container.appendChild(emptyMsg);

    parent.appendChild(this.container);
    this.container.style.display = "none";
  }

  private makeButton(text: string, bg: string, border: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      padding: 12px 28px; font-size: 18px; background: ${bg}; color: white;
      border: 2px solid ${border}; cursor: pointer; border-radius: 4px;
      font-weight: bold; letter-spacing: 1px;
    `;
    btn.addEventListener("mouseenter", () => { btn.style.filter = "brightness(1.2)"; });
    btn.addEventListener("mouseleave", () => { btn.style.filter = ""; });
    return btn;
  }

  onCreate(callback: () => void): void {
    this.createCallback = callback;
  }

  onJoin(callback: (roomId: string) => void): void {
    this.joinCallback = callback;
  }

  onQuickPlay(callback: () => void): void {
    this.quickPlayCallback = callback;
  }

  updateRoomList(rooms: RoomListItem[]): void {
    this.listContainer.innerHTML = "";
    const emptyMsg = document.getElementById("lobby-empty-msg");
    if (emptyMsg) {
      emptyMsg.style.display = rooms.length === 0 ? "" : "none";
    }

    for (const room of rooms) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex; align-items: center; padding: 8px 12px;
        border-bottom: 1px solid #333; font-size: 15px;
      `;

      const phase = room.metadata?.phase || "lobby";
      const phaseInfo = PHASE_LABELS[phase] || PHASE_LABELS.lobby;
      const isFull = room.clients >= room.maxClients;
      const canJoin = phase === "lobby" && !isFull;

      // Name
      const name = document.createElement("span");
      name.style.cssText = "flex:2; color: #eee;";
      name.textContent = room.metadata?.roomName || room.roomId;
      row.appendChild(name);

      // Player count
      const count = document.createElement("span");
      count.style.cssText = "flex:1; text-align:center; color: #ccc;";
      count.textContent = `${room.clients}/${room.maxClients}`;
      row.appendChild(count);

      // Phase
      const phaseEl = document.createElement("span");
      phaseEl.style.cssText = `flex:1; text-align:center; color: ${phaseInfo.color}; font-weight: bold;`;
      phaseEl.textContent = phaseInfo.text;
      row.appendChild(phaseEl);

      // Join button
      const btnCell = document.createElement("span");
      btnCell.style.cssText = "flex:1; text-align:center;";
      if (canJoin) {
        const joinBtn = document.createElement("button");
        joinBtn.textContent = "Rejoindre";
        joinBtn.style.cssText = `
          padding: 4px 14px; font-size: 13px; background: #2266cc; color: white;
          border: 1px solid #4488ee; cursor: pointer; border-radius: 3px;
        `;
        joinBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.joinCallback?.(room.roomId);
        });
        btnCell.appendChild(joinBtn);
      }
      row.appendChild(btnCell);

      this.listContainer.appendChild(row);
    }
  }

  show(): void { this.container.style.display = "flex"; }
  hide(): void { this.container.style.display = "none"; }
}
