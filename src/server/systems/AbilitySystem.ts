import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { ProjectileState } from "../state/ProjectileState.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { LightingSystem } from "./LightingSystem.js";
import { STATS, LAMP } from "../../shared/constants.js";
import { AbilityType, PlayerRole, ServerMsg, WeaponType } from "../../shared/types.js";
import type { Client, Room } from "@colyseus/core";

let projectileCounter = 0;

interface SmokeZone {
  x: number;
  z: number;
  radius: number;
  expiresAt: number;
}

export class AbilitySystem {
  private smokeZones: SmokeZone[] = [];

  constructor(
    private state: GameState,
    private physics: PhysicsSystem,
    private lighting: LightingSystem,
    private room: Room,
  ) {}

  handleAbility(client: Client, player: PlayerState, data: { ability: string; targetX?: number; targetZ?: number }): void {
    const now = Date.now();

    switch (data.ability) {
      case AbilityType.WATER_BOMB:
        this.handleWaterBomb(player, data.targetX ?? player.x, data.targetZ ?? player.z, now);
        break;
      case AbilityType.SMOKE_BOMB:
        this.handleSmokeBomb(player, data.targetX ?? player.x, data.targetZ ?? player.z, now);
        break;
      case AbilityType.GRAPPLING_HOOK:
        this.handleGrapplingHook(player, now);
        break;
      case AbilityType.SHOGUN_CHARGE:
        this.handleShogunCharge(player, now);
        break;
      case AbilityType.TORCH_RELIGHT:
        this.handleTorchRelight(player, now);
        break;
    }
  }

  private clampTarget(playerX: number, playerZ: number, targetX: number, targetZ: number): { x: number; z: number } {
    const dx = targetX - playerX;
    const dz = targetZ - playerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxDist = STATS.ninja.bombMaxThrowDist;
    if (dist > maxDist && dist > 0) {
      const scale = maxDist / dist;
      return { x: playerX + dx * scale, z: playerZ + dz * scale };
    }
    return { x: targetX, z: targetZ };
  }

  private handleWaterBomb(player: PlayerState, targetX: number, targetZ: number, now: number): void {
    if (player.role !== PlayerRole.NINJA || player.waterBombsLeft <= 0) return;
    player.waterBombsLeft--;

    const clamped = this.clampTarget(player.x, player.z, targetX, targetZ);

    const proj = new ProjectileState();
    proj.id = `wb_${++projectileCounter}`;
    proj.kind = "water_bomb";
    proj.ownerSessionId = player.sessionId;
    proj.x = player.x;
    proj.y = 1.5;
    proj.z = player.z;
    proj.targetX = clamped.x;
    proj.targetZ = clamped.z;
    proj.active = true;
    proj.startTime = now;
    proj.travelDurationMs = 800;
    proj.startX = player.x;
    proj.startZ = player.z;

    this.state.projectiles.set(proj.id, proj);
  }

  private handleSmokeBomb(player: PlayerState, targetX: number, targetZ: number, now: number): void {
    if (player.role !== PlayerRole.NINJA || player.smokeBombsLeft <= 0) return;
    player.smokeBombsLeft--;

    const clamped = this.clampTarget(player.x, player.z, targetX, targetZ);

    const proj = new ProjectileState();
    proj.id = `sb_${++projectileCounter}`;
    proj.kind = "smoke_bomb";
    proj.ownerSessionId = player.sessionId;
    proj.x = player.x;
    proj.y = 1.5;
    proj.z = player.z;
    proj.targetX = clamped.x;
    proj.targetZ = clamped.z;
    proj.active = true;
    proj.startTime = now;
    proj.travelDurationMs = 600;
    proj.startX = player.x;
    proj.startZ = player.z;

    this.state.projectiles.set(proj.id, proj);
  }

  private handleGrapplingHook(player: PlayerState, _now: number): void {
    if (player.role !== PlayerRole.NINJA || !player.hasGrapplingHook) return;
    if (!this.physics.isNearWall(player.x, player.z, 2.0)) return;

    player.isClimbing = true;
    player.hasGrapplingHook = false;

    const climbHeight = 6; // wall height
    const wallPt = this.physics.getNearestWallPoint(player.x, player.z);
    const wallX = wallPt ? wallPt.wx : player.x;
    const wallZ = wallPt ? wallPt.wz : player.z;

    // Broadcast at START so clients can play the full animation
    this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
      ability: AbilityType.GRAPPLING_HOOK,
      casterSessionId: player.sessionId,
      startX: player.x,
      startZ: player.z,
      wallX,
      wallZ,
      wallY: climbHeight,
    });

    // Simulate climbing over 1.5 seconds
    const steps = 15;
    const stepDuration = 100;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      player.y = (step / steps) * climbHeight;
      if (step >= steps) {
        clearInterval(interval);
        player.isClimbing = false;
        player.y = 0;
        // Move player slightly past the wall
        const dirX = Math.sin(player.rotationY);
        const dirZ = Math.cos(player.rotationY);
        player.x += dirX * 2;
        player.z += dirZ * 2;
      }
    }, stepDuration);
  }

  private handleShogunCharge(player: PlayerState, now: number): void {
    if (player.role !== PlayerRole.SHOGUN) return;
    if (now < player.chargeCooldownUntil) return;

    player.chargeCooldownUntil = now + STATS.shogun.chargeCooldownMs;

    const dirX = Math.sin(player.rotationY);
    const dirZ = Math.cos(player.rotationY);
    const chargeDist = STATS.shogun.chargeDist;

    // Move shogun forward
    const endX = player.x + dirX * chargeDist;
    const endZ = player.z + dirZ * chargeDist;

    // Check collision along path (simplified: check end position)
    if (!this.physics.collidesWithWall(endX, endZ)) {
      player.x = endX;
      player.z = endZ;
    }

    // Stun any ninja in the charge path
    const ninjas = this.physics.getPlayersInCone(
      this.state, player.x, player.z,
      -dirX, -dirZ, chargeDist, Math.PI / 4
    );

    for (const target of ninjas) {
      if (target.role === PlayerRole.NINJA && target.alive) {
        target.isStunned = true;
        target.stunUntil = now + STATS.shogun.chargeStunMs;
      }
    }

    this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
      ability: AbilityType.SHOGUN_CHARGE,
      casterSessionId: player.sessionId,
      x: player.x,
      z: player.z,
    });
  }

  private handleTorchRelight(player: PlayerState, now: number): void {
    if (player.role !== PlayerRole.SAMURAI) return;
    if (player.weapon !== WeaponType.TORCH) return;
    if (player.torchesLeft <= 0) return;

    // If already channeling, ignore
    if (player.channelingLampId) return;

    const lamp = this.lighting.findNearestUnlitLamp(player.x, player.z, LAMP.RELIGHT_RANGE);
    if (!lamp) return;

    // Start channeling
    player.channelingLampId = lamp.id;
    player.channelingStartTime = now;

    this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
      ability: AbilityType.TORCH_RELIGHT_START,
      casterSessionId: player.sessionId,
      lampId: lamp.id,
      duration: LAMP.RELIGHT_TIME_MS,
    });
  }

  updateChanneling(now: number): void {
    this.state.players.forEach((player) => {
      if (!player.channelingLampId) return;

      // Validate channeling conditions
      if (
        !player.alive ||
        player.isStunned ||
        player.weapon !== WeaponType.TORCH
      ) {
        this.cancelChanneling(player);
        return;
      }

      // Check range to lamp
      const lamp = this.lighting.getLampState(player.channelingLampId);
      if (!lamp || lamp.lit) {
        this.cancelChanneling(player);
        return;
      }

      const dSq = this.distSq(player.x, player.z, lamp.x, lamp.z);
      if (dSq > LAMP.RELIGHT_RANGE * LAMP.RELIGHT_RANGE) {
        this.cancelChanneling(player);
        return;
      }

      // Check if channeling is complete
      if (now - player.channelingStartTime >= LAMP.RELIGHT_TIME_MS) {
        this.lighting.relightLamp(player.channelingLampId);
        player.torchesLeft--;
        this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
          ability: AbilityType.TORCH_RELIGHT,
          casterSessionId: player.sessionId,
          lampId: player.channelingLampId,
          x: lamp.x,
          z: lamp.z,
        });
        player.channelingLampId = null;
        player.channelingStartTime = 0;
      }
    });
  }

  private cancelChanneling(player: PlayerState): void {
    const lampId = player.channelingLampId;
    player.channelingLampId = null;
    player.channelingStartTime = 0;

    this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
      ability: AbilityType.TORCH_RELIGHT_CANCEL,
      casterSessionId: player.sessionId,
      lampId,
    });
  }

  private distSq(x1: number, z1: number, x2: number, z2: number): number {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return dx * dx + dz * dz;
  }

  updateProjectiles(deltaTime: number): void {
    const now = Date.now();

    this.state.projectiles.forEach((proj, id) => {
      if (!proj.active) return;

      const elapsed = now - proj.startTime;
      const t = Math.min(1, elapsed / proj.travelDurationMs);

      // Lerp position
      proj.x = proj.startX + (proj.targetX - proj.startX) * t;
      proj.z = proj.startZ + (proj.targetZ - proj.startZ) * t;
      // Parabolic arc for Y
      proj.y = 1.5 + Math.sin(t * Math.PI) * 3;

      if (t >= 1) {
        // Projectile arrived at target
        proj.active = false;
        this.onProjectileImpact(proj);

        // Remove after a short delay so clients can see the impact
        setTimeout(() => {
          this.state.projectiles.delete(id);
        }, 100);
      }
    });

    // Update smoke zones
    this.updateSmokeZones(now);

    // Update stun timers
    this.state.players.forEach((player) => {
      if (player.isStunned && now >= player.stunUntil) {
        player.isStunned = false;
      }
    });
  }

  private onProjectileImpact(proj: ProjectileState): void {
    if (proj.kind === "water_bomb") {
      // Extinguish nearest lit lamp within blast radius
      const lamp = this.lighting.findNearestLitLamp(proj.targetX, proj.targetZ, STATS.ninja.waterBombBlastRadius);
      if (lamp) {
        this.lighting.extinguishLamp(lamp.id);
      }
      // Always show splash effect on impact
      this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
        ability: AbilityType.WATER_BOMB,
        casterSessionId: proj.ownerSessionId,
        x: proj.targetX,
        z: proj.targetZ,
        radius: STATS.ninja.waterBombBlastRadius,
      });
    } else if (proj.kind === "smoke_bomb") {
      this.smokeZones.push({
        x: proj.targetX,
        z: proj.targetZ,
        radius: STATS.ninja.smokeBombRadius,
        expiresAt: Date.now() + STATS.ninja.smokeBombDurationMs,
      });

      this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
        ability: AbilityType.SMOKE_BOMB,
        casterSessionId: proj.ownerSessionId,
        x: proj.targetX,
        z: proj.targetZ,
        radius: STATS.ninja.smokeBombRadius,
        duration: STATS.ninja.smokeBombDurationMs,
      });
    }
  }

  private updateSmokeZones(now: number): void {
    // Remove expired zones
    this.smokeZones = this.smokeZones.filter((z) => z.expiresAt > now);

    // Update player isInSmoke flags
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      let inSmoke = false;
      for (const zone of this.smokeZones) {
        const dx = player.x - zone.x;
        const dz = player.z - zone.z;
        if (dx * dx + dz * dz <= zone.radius * zone.radius) {
          inSmoke = true;
          break;
        }
      }
      player.isInSmoke = inSmoke;
    });
  }
}
