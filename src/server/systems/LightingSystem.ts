import { GameState } from "../state/GameState.js";
import { LampState } from "../state/LampState.js";
import { LAMP } from "../../shared/constants.js";

export interface LampPosition {
  id: string;
  x: number;
  z: number;
}

export class LightingSystem {
  private lampPositions: LampPosition[];

  constructor(private state: GameState, lampPositions: LampPosition[]) {
    this.lampPositions = lampPositions;
  }

  // DEV: lamps that start unlit for testing relight
  private static DEV_UNLIT = new Set(["lamp_28", "lamp_29", "lamp_30"]);

  initializeLamps(): void {
    for (const pos of this.lampPositions) {
      const lamp = new LampState();
      lamp.id = pos.id;
      lamp.x = pos.x;
      lamp.z = pos.z;
      lamp.y = LAMP.DEFAULT_HEIGHT;
      lamp.lit = !LightingSystem.DEV_UNLIT.has(pos.id);
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

  getLampState(lampId: string): LampState | undefined {
    return this.state.lamps.get(lampId);
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
