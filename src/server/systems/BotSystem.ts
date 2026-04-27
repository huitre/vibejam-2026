import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import { AbilitySystem } from "./AbilitySystem.js";
import { LightingSystem } from "./LightingSystem.js";
import { VisionSystem } from "./VisionSystem.js";
import { STATS, LAMP } from "../../shared/constants.js";
import { PlayerRole, WeaponType, AbilityType } from "../../shared/types.js";

const SEARCH_ARRIVE_DIST = 4;
const RELIGHT_SEARCH_RADIUS = 20;
const PATROL_RADIUS = 20;
const ALERT_PROPAGATION_RADIUS = 25;
const MAX_CHASERS = 3;
const CHASE_TIMEOUT_MS = 5000;
const ALERT_TIMEOUT_MS = 10000;

type AlertLevel = "patrol" | "alert" | "chase";

interface BotData {
  sessionId: string;
  targetLampId: string | null;
  searchX: number;
  searchZ: number;
  hasSearchTarget: boolean;
  stuckTicks: number;
  randomRotation: number;
  lastX: number;
  lastZ: number;
  alertLevel: AlertLevel;
  alertExpiry: number;
  lastKnownNinjaX: number;
  lastKnownNinjaZ: number;
  patrolCenterX: number;
  patrolCenterZ: number;
}

export class BotSystem {
  private bots: Map<string, BotData> = new Map();

  constructor(
    private state: GameState,
    private physics: PhysicsSystem,
    private combat: CombatSystem,
    private ability: AbilitySystem,
    private lighting: LightingSystem,
    private vision: VisionSystem,
  ) {}

  spawnBot(player: PlayerState): void {
    this.bots.set(player.sessionId, {
      sessionId: player.sessionId,
      targetLampId: null,
      searchX: 0,
      searchZ: 0,
      hasSearchTarget: false,
      stuckTicks: 0,
      randomRotation: 0,
      lastX: player.x,
      lastZ: player.z,
      alertLevel: "patrol",
      alertExpiry: 0,
      lastKnownNinjaX: 0,
      lastKnownNinjaZ: 0,
      patrolCenterX: player.spawnX,
      patrolCenterZ: player.spawnZ,
    });
  }

  resetAll(): void {
    this.bots.forEach((botData) => {
      botData.targetLampId = null;
      botData.hasSearchTarget = false;
      botData.stuckTicks = 0;
      botData.randomRotation = 0;
      botData.alertLevel = "patrol";
      botData.alertExpiry = 0;
      const player = this.state.players.get(botData.sessionId);
      if (player) {
        botData.lastX = player.x;
        botData.lastZ = player.z;
        botData.patrolCenterX = player.spawnX;
        botData.patrolCenterZ = player.spawnZ;
      }
    });
  }

  update(deltaMs: number): void {
    this.bots.forEach((botData) => {
      const player = this.state.players.get(botData.sessionId);
      if (!player || !player.alive || player.isStunned) return;

      if (player.role === PlayerRole.NINJA) {
        const shogun = this.findShogun();
        if (shogun) this.updateNinja(botData, player, shogun, deltaMs);
      } else if (player.role === PlayerRole.SHOGUN) {
        const ninja = this.findNinja();
        if (ninja) this.updateShogun(botData, player, ninja, deltaMs);
      } else if (player.role === PlayerRole.SAMURAI) {
        const ninja = this.findNinja();
        if (ninja) this.updateSamurai(botData, player, ninja, deltaMs);
      }

      // Detect stuck (hasn't moved significantly since last tick)
      const movedSq = this.distSq(player.x, player.z, botData.lastX, botData.lastZ);
      if (movedSq < 0.01) {
        botData.stuckTicks++;
      } else {
        botData.stuckTicks = 0;
      }
      botData.lastX = player.x;
      botData.lastZ = player.z;
    });
  }

  private findNinja(): PlayerState | null {
    let ninja: PlayerState | null = null;
    this.state.players.forEach((p) => {
      if (p.role === PlayerRole.NINJA && p.alive) ninja = p;
    });
    return ninja;
  }

  private findShogun(): PlayerState | null {
    let shogun: PlayerState | null = null;
    this.state.players.forEach((p) => {
      if (p.role === PlayerRole.SHOGUN && p.alive) shogun = p;
    });
    return shogun;
  }

  private distSq(ax: number, az: number, bx: number, bz: number): number {
    const dx = ax - bx;
    const dz = az - bz;
    return dx * dx + dz * dz;
  }

  private moveToward(botData: BotData, player: PlayerState, tx: number, tz: number, deltaMs: number, sprint: boolean): void {
    let dx = tx - player.x;
    let dz = tz - player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.3) return;

    // If stuck, rotate direction to escape obstacles
    if (botData.stuckTicks > 3) {
      if (botData.stuckTicks === 4) {
        botData.randomRotation = (Math.random() - 0.5) * Math.PI;
      }
      const cos = Math.cos(botData.randomRotation);
      const sin = Math.sin(botData.randomRotation);
      const rdx = dx * cos - dz * sin;
      const rdz = dx * sin + dz * cos;
      dx = rdx;
      dz = rdz;
      if (botData.stuckTicks > 15) {
        botData.stuckTicks = 0;
        botData.randomRotation = 0;
        // Also pick a new search target when stuck too long
        botData.hasSearchTarget = false;
      }
    }

    // Normalize
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx /= len;
      dz /= len;
    }

    // rotationY = angle from +Z toward +X
    const rotationY = Math.atan2(dx, dz);
    player.rotationY = rotationY;

    // Move forward in local space (dz=1 means forward)
    this.physics.applyMovement(player, 0, 1, rotationY, deltaMs, sprint);
  }

  private pickRandomSearchPoint(player: PlayerState): { x: number; z: number } {
    const bounds = this.physics.getBounds();
    const margin = 5;
    // Pick a point at least 15 units away from current position
    for (let i = 0; i < 10; i++) {
      const x = margin + Math.random() * (bounds.width - margin * 2);
      const z = margin + Math.random() * (bounds.depth - margin * 2);
      if (this.distSq(player.x, player.z, x, z) > 15 * 15) {
        return { x, z };
      }
    }
    // Fallback: just pick any random point
    return {
      x: margin + Math.random() * (bounds.width - margin * 2),
      z: margin + Math.random() * (bounds.depth - margin * 2),
    };
  }

  private pickPatrolPoint(botData: BotData): { x: number; z: number } {
    const bounds = this.physics.getBounds();
    const margin = 5;
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * PATROL_RADIUS;
      const x = botData.patrolCenterX + Math.cos(angle) * dist;
      const z = botData.patrolCenterZ + Math.sin(angle) * dist;
      // Clamp within map bounds
      const cx = Math.max(margin, Math.min(bounds.width - margin, x));
      const cz = Math.max(margin, Math.min(bounds.depth - margin, z));
      if (this.distSq(botData.lastX, botData.lastZ, cx, cz) > 4 * 4) {
        return { x: cx, z: cz };
      }
    }
    return { x: botData.patrolCenterX, z: botData.patrolCenterZ };
  }

  private countChasers(): number {
    let count = 0;
    this.bots.forEach((bd) => {
      if (bd.alertLevel === "chase") count++;
    });
    return count;
  }

  private propagateAlert(spotter: BotData, ninjaX: number, ninjaZ: number, now: number): void {
    this.bots.forEach((bd) => {
      if (bd.sessionId === spotter.sessionId) return;
      const player = this.state.players.get(bd.sessionId);
      if (!player || !player.alive || player.role !== PlayerRole.SAMURAI) return;
      const dSq = this.distSq(player.x, player.z,
        this.state.players.get(spotter.sessionId)!.x,
        this.state.players.get(spotter.sessionId)!.z);
      if (dSq > ALERT_PROPAGATION_RADIUS * ALERT_PROPAGATION_RADIUS) return;
      if (bd.alertLevel === "patrol") {
        bd.alertLevel = "alert";
        bd.lastKnownNinjaX = ninjaX;
        bd.lastKnownNinjaZ = ninjaZ;
        bd.alertExpiry = now + ALERT_TIMEOUT_MS;
        bd.hasSearchTarget = false;
      }
    });
  }

  // ── Ninja AI ───────────────────────────────────────────────

  private updateNinja(botData: BotData, player: PlayerState, shogun: PlayerState, deltaMs: number): void {
    const dSq = this.distSq(player.x, player.z, shogun.x, shogun.z);

    // Find nearest defender (samurai or shogun) that can see us
    const nearestThreat = this.findNearestThreat(player);
    const threatDSq = nearestThreat
      ? this.distSq(player.x, player.z, nearestThreat.x, nearestThreat.z)
      : Infinity;

    // Drop caltrops when a defender is chasing close behind
    if (nearestThreat && threatDSq < 6 * 6 && player.caltropsLeft > 0) {
      this.ability.handleAbility(null, player, { ability: AbilityType.CALTROPS });
    }

    // Throw smoke bomb to escape when surrounded or low HP
    if (nearestThreat && threatDSq < 5 * 5 && player.smokeBombsLeft > 0 && player.hp < player.maxHp * 0.5) {
      this.ability.handleAbility(null, player, {
        ability: AbilityType.SMOKE_BOMB,
        targetX: player.x,
        targetZ: player.z,
      });
    }

    // Attack nearby defender if in range
    if (nearestThreat && threatDSq <= STATS.ninja.attackRange * STATS.ninja.attackRange) {
      this.faceTarget(player, nearestThreat);
      this.combat.handleAttack(null, player);
      return;
    }

    // Primary objective: reach and kill the shogun
    const attackRange = STATS.ninja.attackRange;
    if (dSq <= attackRange * attackRange) {
      this.faceTarget(player, shogun);
      this.combat.handleAttack(null, player);
    } else {
      // Sprint toward shogun when far, walk when close to be sneaky
      const sprint = dSq > 15 * 15;
      this.moveToward(botData, player, shogun.x, shogun.z, deltaMs, sprint);
    }
  }

  private findNearestThreat(ninja: PlayerState): PlayerState | null {
    let nearest: PlayerState | null = null;
    let nearestDSq = Infinity;
    this.state.players.forEach((p) => {
      if (p.sessionId === ninja.sessionId || !p.alive) return;
      if (p.role !== PlayerRole.SAMURAI && p.role !== PlayerRole.SHOGUN) return;
      const dSq = this.distSq(ninja.x, ninja.z, p.x, p.z);
      if (dSq < nearestDSq) {
        nearestDSq = dSq;
        nearest = p;
      }
    });
    return nearest;
  }

  // ── Shogun AI ──────────────────────────────────────────────

  private updateShogun(botData: BotData, player: PlayerState, ninja: PlayerState, deltaMs: number): void {
    const canSeeNinja = this.vision.isVisibleTo(player, ninja);
    const dSq = this.distSq(player.x, player.z, ninja.x, ninja.z);

    if (!canSeeNinja) {
      botData.hasSearchTarget = false;
      this.searchRandom(botData, player, deltaMs);
      return;
    }

    // Saw ninja — clear search target
    botData.hasSearchTarget = false;

    // Try charge when ninja is at medium range (~5-10 units)
    if (dSq > 5 * 5 && dSq < 10 * 10) {
      const now = Date.now();
      if (now >= player.chargeCooldownUntil) {
        this.faceTarget(player, ninja);
        this.ability.handleAbility(null, player, { ability: AbilityType.SHOGUN_CHARGE });
        return;
      }
    }

    const attackRange = STATS.shogun.attackRange;
    if (dSq <= attackRange * attackRange) {
      this.faceTarget(player, ninja);
      this.combat.handleAttack(null, player);
    } else {
      this.moveToward(botData, player, ninja.x, ninja.z, deltaMs, true);
    }
  }

  // ── Samurai AI ─────────────────────────────────────────────

  private updateSamurai(botData: BotData, player: PlayerState, ninja: PlayerState, deltaMs: number): void {
    const canSeeNinja = this.vision.isVisibleTo(player, ninja);
    const dSq = this.distSq(player.x, player.z, ninja.x, ninja.z);
    const now = Date.now();

    if (canSeeNinja) {
      // Saw ninja — update known position
      botData.lastKnownNinjaX = ninja.x;
      botData.lastKnownNinjaZ = ninja.z;
      botData.hasSearchTarget = false;

      if (player.channelingLampId) {
        player.channelingLampId = null;
        player.channelingStartTime = 0;
      }
      if (player.weapon !== WeaponType.LANCE) player.weapon = WeaponType.LANCE;

      // Decide chase vs alert based on chaser count
      if (botData.alertLevel !== "chase") {
        if (this.countChasers() < MAX_CHASERS) {
          botData.alertLevel = "chase";
        } else {
          botData.alertLevel = "alert";
          botData.alertExpiry = now + ALERT_TIMEOUT_MS;
        }
      }

      // Propagate alert to nearby bots
      this.propagateAlert(botData, ninja.x, ninja.z, now);

      if (botData.alertLevel === "chase") {
        // Sprint + attack
        const attackRange = STATS.samurai.lanceRange;
        if (dSq <= attackRange * attackRange) {
          this.faceTarget(player, ninja);
          this.combat.handleAttack(null, player);
        } else {
          this.moveToward(botData, player, ninja.x, ninja.z, deltaMs, true);
        }
      } else {
        // Alert: move toward ninja without sprinting
        this.moveToward(botData, player, ninja.x, ninja.z, deltaMs, false);
      }
      return;
    }

    // Can't see ninja — handle alert level transitions
    if (botData.alertLevel === "chase") {
      // Lost sight while chasing → drop to alert
      botData.alertLevel = "alert";
      botData.alertExpiry = now + CHASE_TIMEOUT_MS;
      botData.hasSearchTarget = false;
    }

    if (botData.alertLevel === "alert") {
      if (player.weapon !== WeaponType.LANCE) player.weapon = WeaponType.LANCE;

      // Move toward last known ninja position
      const dToKnown = this.distSq(player.x, player.z, botData.lastKnownNinjaX, botData.lastKnownNinjaZ);
      if (dToKnown < SEARCH_ARRIVE_DIST * SEARCH_ARRIVE_DIST || now > botData.alertExpiry) {
        // Arrived at last known position or alert expired → return to patrol
        botData.alertLevel = "patrol";
        botData.hasSearchTarget = false;
      } else {
        this.moveToward(botData, player, botData.lastKnownNinjaX, botData.lastKnownNinjaZ, deltaMs, false);
      }
      return;
    }

    // PATROL mode: relight lamps near patrol center, then patrol zone
    if (player.torchesLeft > 0) {
      const unlitLamp = this.lighting.findNearestUnlitLamp(player.x, player.z, RELIGHT_SEARCH_RADIUS);
      if (unlitLamp) {
        const lampDSq = this.distSq(player.x, player.z, unlitLamp.x, unlitLamp.z);

        if (lampDSq <= LAMP.RELIGHT_RANGE * LAMP.RELIGHT_RANGE) {
          if (player.weapon !== WeaponType.TORCH) {
            player.weapon = WeaponType.TORCH;
          }
          if (!player.channelingLampId) {
            this.ability.handleAbility(null, player, { ability: AbilityType.TORCH_RELIGHT });
          }
          return;
        }

        if (player.weapon !== WeaponType.LANCE) player.weapon = WeaponType.LANCE;
        this.moveToward(botData, player, unlitLamp.x, unlitLamp.z, deltaMs, false);
        return;
      }
    }

    // Patrol around spawn
    if (player.weapon !== WeaponType.LANCE) player.weapon = WeaponType.LANCE;
    this.patrolZone(botData, player, deltaMs);
  }

  // ── Shared helpers ─────────────────────────────────────────

  private faceTarget(player: PlayerState, target: PlayerState): void {
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    player.rotationY = Math.atan2(dx, dz);
  }

  private patrolZone(botData: BotData, player: PlayerState, deltaMs: number): void {
    if (!botData.hasSearchTarget) {
      const pt = this.pickPatrolPoint(botData);
      botData.searchX = pt.x;
      botData.searchZ = pt.z;
      botData.hasSearchTarget = true;
    }

    const dSq = this.distSq(player.x, player.z, botData.searchX, botData.searchZ);
    if (dSq < SEARCH_ARRIVE_DIST * SEARCH_ARRIVE_DIST) {
      botData.hasSearchTarget = false;
      return;
    }

    this.moveToward(botData, player, botData.searchX, botData.searchZ, deltaMs, false);
  }

  private searchRandom(botData: BotData, player: PlayerState, deltaMs: number): void {
    if (!botData.hasSearchTarget) {
      const pt = this.pickRandomSearchPoint(player);
      botData.searchX = pt.x;
      botData.searchZ = pt.z;
      botData.hasSearchTarget = true;
    }

    const dSq = this.distSq(player.x, player.z, botData.searchX, botData.searchZ);
    if (dSq < SEARCH_ARRIVE_DIST * SEARCH_ARRIVE_DIST) {
      // Arrived — pick a new search point
      botData.hasSearchTarget = false;
      return;
    }

    this.moveToward(botData, player, botData.searchX, botData.searchZ, deltaMs, false);
  }
}
