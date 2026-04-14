import { STATS } from "../../shared/constants.js";
import type { LevelCollider, LevelRamp } from "../../shared/levelData.js";
import { PlayerState } from "../state/PlayerState.js";
import { GameState } from "../state/GameState.js";
import { PlayerRole } from "../../shared/types.js";

const PLAYER_RADIUS = 0.4;

export class PhysicsSystem {
  private noclipPlayers = new Set<string>();
  private colliders: LevelCollider[];
  private ramps: LevelRamp[];
  private boundsWidth: number;
  private boundsDepth: number;

  constructor(colliders: LevelCollider[], boundsWidth: number, boundsDepth: number, ramps: LevelRamp[] = []) {
    this.colliders = colliders;
    this.ramps = ramps;
    this.boundsWidth = boundsWidth;
    this.boundsDepth = boundsDepth;
  }

  toggleNoclip(sessionId: string): void {
    if (this.noclipPlayers.has(sessionId)) {
      this.noclipPlayers.delete(sessionId);
    } else {
      this.noclipPlayers.add(sessionId);
    }
  }

  applyMovement(player: PlayerState, dx: number, dz: number, rotationY: number, deltaMs: number, wantsSprint: boolean = false): void {
    if (!player.alive || player.isStunned) return;

    const stats = STATS[player.role as keyof typeof STATS];
    let speed = ('moveSpeed' in stats) ? stats.moveSpeed : 5;
    const dt = deltaMs / 1000;
    const moving = dx !== 0 || dz !== 0;

    // Sprint: boost speed and drain stamina
    if (wantsSprint && moving && player.stamina > 0) {
      speed *= stats.sprintMultiplier;
      player.stamina = Math.max(0, player.stamina - Math.round(stats.staminaDrain * dt));
      if (!player.isSprinting) {
        player.isSprinting = true;
      }
    } else {
      if (player.isSprinting) {
        player.isSprinting = false;
        player.sprintStoppedAt = Date.now();
      }
    }

    speed *= player.slowFactor;

    // Camera-relative movement: forward is +Z in local space (camera behind at -Z)
    // Forward vector at yaw phi: (sin(phi), 0, cos(phi))
    // Right vector at yaw phi:   (cos(phi), 0, -sin(phi))
    const sin = Math.sin(rotationY);
    const cos = Math.cos(rotationY);
    const worldDx = (sin * dz + cos * dx) * speed * dt;
    const worldDz = (cos * dz - sin * dx) * speed * dt;

    const newX = player.x + worldDx;
    const newZ = player.z + worldDz;

    // Check collision (skip for noclip players)
    if (this.noclipPlayers.has(player.sessionId) || !this.collidesWithWall(newX, newZ)) {
      player.x = Math.max(PLAYER_RADIUS, Math.min(this.boundsWidth - PLAYER_RADIUS, newX));
      player.z = Math.max(PLAYER_RADIUS, Math.min(this.boundsDepth - PLAYER_RADIUS, newZ));
    } else {
      // Try sliding along axes
      if (!this.collidesWithWall(newX, player.z)) {
        player.x = Math.max(PLAYER_RADIUS, Math.min(this.boundsWidth - PLAYER_RADIUS, newX));
      }
      if (!this.collidesWithWall(player.x, newZ)) {
        player.z = Math.max(PLAYER_RADIUS, Math.min(this.boundsDepth - PLAYER_RADIUS, newZ));
      }
    }

    player.y = this.getHeightAtPosition(player.x, player.z);
    player.rotationY = rotationY;
  }

  getHeightAtPosition(x: number, z: number): number {
    let maxHeight = 0;
    for (const ramp of this.ramps) {
      // Transform position into ramp local space (inverse rotationY around ramp center)
      const cx = (ramp.minX + ramp.maxX) / 2;
      const cz = (ramp.minZ + ramp.maxZ) / 2;
      const rotY = ramp.rotationY ?? 0;
      let testX: number, testZ: number;
      if (rotY === 0) {
        testX = x;
        testZ = z;
      } else {
        const dx = x - cx;
        const dz = z - cz;
        const cos = Math.cos(-rotY);
        const sin = Math.sin(-rotY);
        testX = dx * cos - dz * sin + cx;
        testZ = dx * sin + dz * cos + cz;
      }

      if (testX < ramp.minX || testX > ramp.maxX || testZ < ramp.minZ || testZ > ramp.maxZ) continue;

      let t: number;
      if (ramp.direction === 'x') {
        t = (ramp.maxX - ramp.minX) > 0 ? (testX - ramp.minX) / (ramp.maxX - ramp.minX) : 0;
      } else {
        t = (ramp.maxZ - ramp.minZ) > 0 ? (testZ - ramp.minZ) / (ramp.maxZ - ramp.minZ) : 0;
      }
      if (!ramp.ascending) t = 1 - t;

      const height = ramp.startHeight + t * (ramp.endHeight - ramp.startHeight);
      if (height > maxHeight) maxHeight = height;
    }
    return maxHeight;
  }

  collidesWithWall(x: number, z: number): boolean {
    for (const wall of this.colliders) {
      if (
        x + PLAYER_RADIUS > wall.minX &&
        x - PLAYER_RADIUS < wall.maxX &&
        z + PLAYER_RADIUS > wall.minZ &&
        z - PLAYER_RADIUS < wall.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  isNearWall(x: number, z: number, maxDist: number): boolean {
    for (const wall of this.colliders) {
      const closestX = Math.max(wall.minX, Math.min(x, wall.maxX));
      const closestZ = Math.max(wall.minZ, Math.min(z, wall.maxZ));
      const distSq = (x - closestX) ** 2 + (z - closestZ) ** 2;
      if (distSq <= maxDist * maxDist) return true;
    }
    return false;
  }

  getNearestWallPoint(x: number, z: number): { wx: number; wz: number; height: number } | null {
    let bestDistSq = Infinity;
    let bestX = x;
    let bestZ = z;
    let bestHeight = 6;
    for (const wall of this.colliders) {
      const cx = Math.max(wall.minX, Math.min(x, wall.maxX));
      const cz = Math.max(wall.minZ, Math.min(z, wall.maxZ));
      const dSq = (x - cx) ** 2 + (z - cz) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestX = cx;
        bestZ = cz;
        bestHeight = wall.height ?? 6;
      }
    }
    if (bestDistSq === Infinity) return null;
    return { wx: bestX, wz: bestZ, height: bestHeight };
  }

  getPlayersInRadius(state: GameState, x: number, z: number, radius: number): PlayerState[] {
    const result: PlayerState[] = [];
    const radiusSq = radius * radius;
    state.players.forEach((player) => {
      if (!player.alive) return;
      const dx = player.x - x;
      const dz = player.z - z;
      if (dx * dx + dz * dz <= radiusSq) {
        result.push(player);
      }
    });
    return result;
  }

  updateStamina(state: GameState, deltaMs: number): void {
    const now = Date.now();
    const dt = deltaMs / 1000;
    state.players.forEach((player) => {
      if (!player.alive || player.isSprinting) return;
      if (player.stamina >= player.maxStamina) return;
      const stats = STATS[player.role as keyof typeof STATS];
      if (now - player.sprintStoppedAt < stats.staminaRegenDelay) return;
      player.stamina = Math.min(player.maxStamina, player.stamina + Math.round(stats.staminaRegen * dt));
    });
  }

  getPlayersInCone(
    state: GameState,
    x: number, z: number,
    dirX: number, dirZ: number,
    range: number, halfAngle: number
  ): PlayerState[] {
    const result: PlayerState[] = [];
    const rangeSq = range * range;
    const cosHalfAngle = Math.cos(halfAngle);

    state.players.forEach((player) => {
      if (!player.alive) return;
      const dx = player.x - x;
      const dz = player.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq > rangeSq || distSq < 0.01) return;

      const dist = Math.sqrt(distSq);
      const dot = (dx * dirX + dz * dirZ) / dist;
      if (dot >= cosHalfAngle) {
        result.push(player);
      }
    });
    return result;
  }
}
