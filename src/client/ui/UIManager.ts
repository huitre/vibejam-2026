import { RoleSelectScreen } from "./RoleSelectScreen.js";
import { HUD } from "./HUD.js";
import { GameOverScreen } from "./GameOverScreen.js";
import { GamePhase } from "../../shared/types.js";

export class UIManager {
  private root: HTMLElement;
  private roleSelect: RoleSelectScreen;
  private hud: HUD;
  private gameOver: GameOverScreen;
  private currentPhase: string = GamePhase.LOBBY;

  constructor() {
    this.root = document.getElementById("ui-root")!;
    this.roleSelect = new RoleSelectScreen(this.root);
    this.hud = new HUD(this.root);
    this.gameOver = new GameOverScreen(this.root);

    this.roleSelect.show();
  }

  onPhaseChange(phase: string): void {
    this.currentPhase = phase;
    this.roleSelect.hide();
    this.hud.hide();
    this.gameOver.hide();

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

  setRole(role: string): void {
    this.roleSelect.setRole(role);
    this.hud.setRole(role);
  }

  setPlayerCount(count: number): void {
    this.roleSelect.setPlayerCount(count);
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

  onReady(callback: () => void): void {
    this.roleSelect.onReady(callback);
  }
}
