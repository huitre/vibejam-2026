import type { Room } from "colyseus.js";
import { ClientMsg } from "../../shared/types.js";

export class InputSender {
  private room: Room;
  private sendInterval = 50; // ms
  private timeSinceLastSend = 0;

  constructor(room: Room) {
    this.room = room;
  }

  update(deltaMs: number, moveDir: { dx: number; dz: number }, rotationY: number, sprint: boolean = false): void {
    this.timeSinceLastSend += deltaMs;
    if (this.timeSinceLastSend >= this.sendInterval) {
      this.room.send(ClientMsg.MOVE, {
        dx: moveDir.dx,
        dz: moveDir.dz,
        rotationY,
        sprint,
      });
      this.timeSinceLastSend = 0;
    }
  }

  sendAttack(): void {
    this.room.send(ClientMsg.ATTACK, { targetX: 0, targetZ: 0 });
  }

  sendAbility(ability: string, targetX?: number, targetZ?: number): void {
    this.room.send(ClientMsg.USE_ABILITY, { ability, targetX, targetZ });
  }

  sendSelectWeapon(weapon: string): void {
    this.room.send(ClientMsg.SELECT_WEAPON, { weapon });
  }

  sendReady(): void {
    this.room.send(ClientMsg.READY, {});
  }

  sendDebugNoclip(): void {
    this.room.send(ClientMsg.DEBUG_NOCLIP, {});
  }
}
