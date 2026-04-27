import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { LAMP, STATS } from "../../shared/constants.js";
import { PlayerRole, WeaponType } from "../../shared/types.js";

const MELEE_DETECT_RANGE = 3;

export class VisionSystem {
  constructor(private state: GameState) {}

  isVisibleTo(observer: PlayerState, target: PlayerState): boolean {
    if (!target.alive) return false;
    if (observer.sessionId === target.sessionId) return true;

    // Ninja in smoke is invisible to everyone
    if (target.role === PlayerRole.NINJA && target.isInSmoke) return false;

    const dx = target.x - observer.x;
    const dz = target.z - observer.z;
    const distSq = dx * dx + dz * dz;

    // Ninja in stealth (in darkness) — only visible at melee range
    if (target.role === PlayerRole.NINJA && target.isInStealth) {
      // Samurai holding a torch can still reveal nearby stealthed ninja
      if (observer.role === PlayerRole.SAMURAI && observer.weapon === WeaponType.TORCH) {
        return distSq <= STATS.samurai.torchRange * STATS.samurai.torchRange;
      }
      return distSq <= MELEE_DETECT_RANGE * MELEE_DETECT_RANGE;
    }

    // Samurai holding a torch can see within torchRange
    if (observer.role === PlayerRole.SAMURAI && observer.weapon === WeaponType.TORCH) {
      if (distSq <= STATS.samurai.torchRange * STATS.samurai.torchRange) {
        return true;
      }
    }

    // Check if target is near any lit lamp
    let targetInLight = false;
    this.state.lamps.forEach((lamp) => {
      if (!lamp.lit) return;
      const ldx = target.x - lamp.x;
      const ldz = target.z - lamp.z;
      if (ldx * ldx + ldz * ldz <= LAMP.LIGHT_RADIUS * LAMP.LIGHT_RADIUS) {
        targetInLight = true;
      }
    });

    return targetInLight;
  }
}
