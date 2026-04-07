import { GameState } from "../state/GameState.js";
import { LampState } from "../state/LampState.js";
import { LAMP_POSITIONS, LAMP } from "../../shared/constants.js";

export class LightingSystem {
  constructor(private state: GameState) {}

  initializeLamps(): void {
    for (const pos of LAMP_POSITIONS) {
      const lamp = new LampState();
      lamp.id = pos.id;
      lamp.x = pos.x;
      lamp.z = pos.z;
      lamp.y = LAMP.DEFAULT_HEIGHT;
      lamp.lit = true;
      this.state.lamps.set(pos.id, lamp);
    }
  }

  extinguishLamp(lampId: string): boolean {
    const lamp = this.state.lamps.get(lampId);
    if (lamp && lamp.lit) {
      lamp.lit = false;
      return true;
    }
    return false;
  }

  relightLamp(lampId: string): boolean {
    const lamp = this.state.lamps.get(lampId);
    if (lamp && !lamp.lit) {
      lamp.lit = true;
      return true;
    }
    return false;
  }

  findNearestUnlitLamp(x: number, z: number, maxRange: number): LampState | null {
    let nearest: LampState | null = null;
    let nearestDistSq = maxRange * maxRange;

    this.state.lamps.forEach((lamp) => {
      if (lamp.lit) return;
      const dx = lamp.x - x;
      const dz = lamp.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = lamp;
      }
    });

    return nearest;
  }

  findNearestLitLamp(x: number, z: number, maxRange: number): LampState | null {
    let nearest: LampState | null = null;
    let nearestDistSq = maxRange * maxRange;

    this.state.lamps.forEach((lamp) => {
      if (!lamp.lit) return;
      const dx = lamp.x - x;
      const dz = lamp.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = lamp;
      }
    });

    return nearest;
  }
}
