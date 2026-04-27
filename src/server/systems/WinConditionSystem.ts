import { GameState } from "../state/GameState.js";
import { PlayerRole, GamePhase, ServerMsg } from "../../shared/types.js";
import { GAME } from "../../shared/constants.js";
import type { Room } from "@colyseus/core";

interface RoomWithReset extends Room {
  resetRound(): void;
}

export class WinConditionSystem {
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private state: GameState, private room: RoomWithReset) {}

  check(now: number): void {
    if (this.state.phase !== GamePhase.PLAYING) return;

    let shogunExists = false;
    let shogunAlive = false;
    let ninjaExists = false;
    let ninjaAlive = false;

    this.state.players.forEach((player) => {
      if (player.role === PlayerRole.SHOGUN) {
        shogunExists = true;
        if (player.alive) shogunAlive = true;
      }
      if (player.role === PlayerRole.NINJA) {
        ninjaExists = true;
        if (player.alive) ninjaAlive = true;
      }
    });

    // Ninja wins only if shogun existed and is now dead
    if (shogunExists && !shogunAlive) {
      this.endGame("ninja", "shogun_killed");
      return;
    }

    // Defenders win only if ninja existed and is now dead
    if (ninjaExists && !ninjaAlive) {
      this.endGame("defenders", "ninja_killed");
      return;
    }

    // Check timeout
    if (this.state.matchTimeRemaining <= 0) {
      this.endGame("defenders", "timeout");
      return;
    }
  }

  private endGame(winner: string, reason: string): void {
    this.state.phase = GamePhase.FINISHED;
    this.state.winnerSide = winner;

    if (winner === "ninja") {
      this.state.ninjaRoundsWon++;
    } else {
      this.state.defenderRoundsWon++;
    }

    this.room.broadcast(ServerMsg.GAME_OVER, { winner, reason });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.room.resetRound();
    }, GAME.ROUND_RESTART_DELAY_MS);
  }

  dispose(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
