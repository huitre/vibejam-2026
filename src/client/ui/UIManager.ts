import { RoomLobbyScreen } from "./RoomLobbyScreen.js";
import { RoleSelectScreen } from "./RoleSelectScreen.js";
import { HUD } from "./HUD.js";
import { GameOverScreen, ScoreEntry } from "./GameOverScreen.js";
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

  updateHUD(hp: number, maxHp: number, timeRemaining: number, stamina: number, maxStamina: number): void {
    this.hud.updateHealth(hp, maxHp);
    this.hud.updateTimer(timeRemaining);
    this.hud.updateStamina(stamina, maxStamina);
  }

  showScoreboard(winner: string, round: number, ninjaWins: number, defenderWins: number, players: ScoreEntry[]): void {
    this.gameOver.setScoreboard(winner, round, ninjaWins, defenderWins, players);
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

  updateNinjaInventory(
    smokeBombs: number, caltrops: number,
    dashReady: boolean = true, dashCooldownSec: number = 0,
    hasKawariminCheckpoint: boolean = false, kawariminReady: boolean = true, kawariminCooldownSec: number = 0,
  ): void {
    this.hud.updateNinjaInventory(smokeBombs, caltrops, dashReady, dashCooldownSec, hasKawariminCheckpoint, kawariminReady, kawariminCooldownSec);
  }

  showSpectator(role: string): void {
    this.hud.showSpectator(role);
  }

  hideSpectator(): void {
    this.hud.hideSpectator();
  }

  showScoreboardOverlay(players: ScoreEntry[]): void {
    this.hud.showScoreboardOverlay(players);
  }

  hideScoreboardOverlay(): void {
    this.hud.hideScoreboardOverlay();
  }

  showBlockIndicator(): void {
    this.hud.showBlockIndicator();
  }

  hideBlockIndicator(): void {
    this.hud.hideBlockIndicator();
  }

  onSelectRole(callback: (role: string) => void): void {
    this.roleSelect.onSelectRole(callback);
  }

  onReady(callback: () => void): void {
    this.roleSelect.onReady(callback);
  }
}
