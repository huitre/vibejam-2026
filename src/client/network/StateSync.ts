import type { Room } from "colyseus.js";

export interface StateSyncCallbacks {
  onPlayerAdded: (sessionId: string, player: any) => void;
  onPlayerRemoved: (sessionId: string) => void;
  onPlayerChanged: (sessionId: string, player: any) => void;
  onLampAdded: (lampId: string, lamp: any) => void;
  onLampChanged: (lampId: string, lit: boolean) => void;
  onProjectileAdded: (id: string, proj: any) => void;
  onProjectileRemoved: (id: string) => void;
}

export class StateSync {
  private room: Room;
  private callbacks: StateSyncCallbacks;

  constructor(room: Room, callbacks: StateSyncCallbacks) {
    this.room = room;
    this.callbacks = callbacks;
  }

  listen(): void {
    const state = this.room.state as any;

    // Players
    state.players.onAdd((player: any, sessionId: string) => {
      this.callbacks.onPlayerAdded(sessionId, player);
      player.onChange(() => {
        this.callbacks.onPlayerChanged(sessionId, player);
      });
    });

    state.players.onRemove((_player: any, sessionId: string) => {
      this.callbacks.onPlayerRemoved(sessionId);
    });

    // Lamps
    state.lamps.onAdd((lamp: any, lampId: string) => {
      this.callbacks.onLampAdded(lampId, lamp);
      lamp.onChange(() => {
        this.callbacks.onLampChanged(lampId, lamp.lit);
      });
    });

    // Projectiles
    state.projectiles.onAdd((proj: any, id: string) => {
      this.callbacks.onProjectileAdded(id, proj);
    });

    state.projectiles.onRemove((_proj: any, id: string) => {
      this.callbacks.onProjectileRemoved(id);
    });
  }

  getState(): any {
    return this.room.state;
  }
}
