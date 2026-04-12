import { RoomLobbyScreen } from "./RoomLobbyScreen.js";
import { RoleSelectScreen } from "./RoleSelectScreen.js";
import { HUD } from "./HUD.js";
import { GameOverScreen } from "./GameOverScreen.js";
import { GamePhase } from "../../shared/types.js";

export class UIManager {
  private root: HTMLElement;
  private roomLobby: RoomLobbyScreen;
  private roleSelect: RoleSelectScreen;
  private hud: HUD;
  private gameOver: GameOverScreen;
  private currentPhase: string = GamePhase.LOBBY;

  constructor() {
    this.root = document.getElementById("ui-root")!;
    this.roomLobby = new RoomLobbyScreen(this.root);
    this.roleSelect = new RoleSelectScreen(this.root);
    this.hud = new HUD(this.root);
    this.gameOver = new GameOverScreen(this.root);

    this.roomLobby.show();
  }

  private hideAll(): void {
    this.roomLobby.hide();
    this.roleSelect.hide();
    this.hud.hide();
    this.gameOver.hide();
  }

  onPhaseChange(phase: string): void {
    this.currentPhase = phase;
    this.hideAll();

    switch (phase) {
      case GamePhase.LOBBY:
        this.roleSelect.show();
        break;
      case GamePhase.PLAYING:
        this.hud.show();
        break;
      case GamePhase.FINISHED:
        this.gameOver.show();
        break;
    }
  }

  getRoomLobby(): RoomLobbyScreen {
    return this.roomLobby;
  }

  showRoomLobby(): void {
    this.hideAll();
    this.roomLobby.show();
  }

  getGameOver(): GameOverScreen {
    return this.gameOver;
  }

  setRole(role: string): void {
    this.roleSelect.setRole(role);
    this.hud.setRole(role);
  }

  setPlayerCount(count: number): void {
    this.roleSelect.setPlayerCount(count);
  }

  showReadyButton(): void {
    this.roleSelect.showReadyButton();
  }

  hideReadyButton(): void {
    this.roleSelect.hideReadyButton();
  }

  updateHUD(hp: number, maxHp: number, timeRemaining: number): void {
    this.hud.updateHealth(hp, maxHp);
    this.hud.updateTimer(timeRemaining);
  }

  showGameOver(winner: string): void {
    this.gameOver.setWinner(winner);
    this.gameOver.show();
  }

  updateDebugCoords(x: number, y: number, z: number, rot: number): void {
    this.hud.updateDebugCoords(x, y, z, rot);
  }

  showBombSelected(kind: string): void {
    this.hud.showBombSelected(kind);
  }

  hideBombSelected(): void {
    this.hud.hideBombSelected();
  }

  updateTorchCount(count: number): void {
    this.hud.updateTorchCount(count);
  }

  onReady(callback: () => void): void {
    this.roleSelect.onReady(callback);
  }
}
