import { WALL_COLLIDERS, STATS, MAP } from "../../shared/constants.js";
import { PlayerState } from "../state/PlayerState.js";
import { GameState } from "../state/GameState.js";
import { PlayerRole } from "../../shared/types.js";

const PLAYER_RADIUS = 0.4;

export class PhysicsSystem {
  private noclipPlayers = new Set<string>();

  toggleNoclip(sessionId: string): void {
    if (this.noclipPlayers.has(sessionId)) {
      this.noclipPlayers.delete(sessionId);
    } else {
      this.noclipPlayers.add(sessionId);
    }
  }

  applyMovement(player: PlayerState, dx: number, dz: number, rotationY: number, deltaMs: number): void {
    if (!player.alive || player.isStunned) return;

    const stats = STATS[player.role as keyof typeof STATS];
    const speed = ('moveSpeed' in stats) ? stats.moveSpeed : 5;
    const dt = deltaMs / 1000;

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
      player.x = Math.max(PLAYER_RADIUS, Math.min(MAP.WIDTH - PLAYER_RADIUS, newX));
      player.z = Math.max(PLAYER_RADIUS, Math.min(MAP.DEPTH - PLAYER_RADIUS, newZ));
    } else {
      // Try sliding along axes
      if (!this.collidesWithWall(newX, player.z)) {
        player.x = Math.max(PLAYER_RADIUS, Math.min(MAP.WIDTH - PLAYER_RADIUS, newX));
      }
      if (!this.collidesWithWall(player.x, newZ)) {
        player.z = Math.max(PLAYER_RADIUS, Math.min(MAP.DEPTH - PLAYER_RADIUS, newZ));
      }
    }

    player.rotationY = rotationY;
  }

  collidesWithWall(x: number, z: number): boolean {
    for (const wall of WALL_COLLIDERS) {
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
    for (const wall of WALL_COLLIDERS) {
      const closestX = Math.max(wall.minX, Math.min(x, wall.maxX));
      const closestZ = Math.max(wall.minZ, Math.min(z, wall.maxZ));
      const distSq = (x - closestX) ** 2 + (z - closestZ) ** 2;
      if (distSq <= maxDist * maxDist) return true;
    }
    return false;
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
