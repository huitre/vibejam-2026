import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import { AbilitySystem } from "./AbilitySystem.js";
import { LightingSystem } from "./LightingSystem.js";
import { VisionSystem } from "./VisionSystem.js";
import { STATS, LAMP } from "../../shared/constants.js";
import { PlayerRole, WeaponType, AbilityType } from "../../shared/types.js";

interface BotData {
  sessionId: string;
  targetLampId: string | null;
  stuckTicks: number;
  randomRotation: number;
  lastX: number;
  lastZ: number;
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
      stuckTicks: 0,
      randomRotation: 0,
      lastX: player.x,
      lastZ: player.z,
    });
  }

  update(deltaMs: number): void {
    const ninja = this.findNinja();
    if (!ninja) return;

    this.bots.forEach((botData) => {
      const player = this.state.players.get(botData.sessionId);
      if (!player || !player.alive || player.isStunned) return;

      if (player.role === PlayerRole.SHOGUN) {
        this.updateShogun(botData, player, ninja, deltaMs);
      } else if (player.role === PlayerRole.SAMURAI) {
        this.updateSamurai(botData, player, ninja, deltaMs);
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

  private pickRandomLamp(preferUnlit: boolean): string | null {
    const lamps: string[] = [];
    const unlitLamps: string[] = [];
    this.state.lamps.forEach((lamp) => {
      lamps.push(lamp.id);
      if (!lamp.lit) unlitLamps.push(lamp.id);
    });

    if (preferUnlit && unlitLamps.length > 0) {
      return unlitLamps[Math.floor(Math.random() * unlitLamps.length)];
    }
    if (lamps.length === 0) return null;
    return lamps[Math.floor(Math.random() * lamps.length)];
  }

  // ── Shogun AI ──────────────────────────────────────────────

  private updateShogun(botData: BotData, player: PlayerState, ninja: PlayerState, deltaMs: number): void {
    const canSeeNinja = this.vision.isVisibleTo(player, ninja);
    const dSq = this.distSq(player.x, player.z, ninja.x, ninja.z);

    if (!canSeeNinja) {
      this.patrolToLamp(botData, player, deltaMs, false);
      return;
    }

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

    // Priority: relight unlit lamps when ninja not visible
    if (!canSeeNinja && player.torchesLeft > 0) {
      const unlitLamp = this.lighting.findNearestUnlitLamp(player.x, player.z, 30);
      if (unlitLamp) {
        const lampDSq = this.distSq(player.x, player.z, unlitLamp.x, unlitLamp.z);

        if (lampDSq <= LAMP.RELIGHT_RANGE * LAMP.RELIGHT_RANGE) {
          // Close enough: switch to torch and channel relight
          if (player.weapon !== WeaponType.TORCH) {
            player.weapon = WeaponType.TORCH;
          }
          if (!player.channelingLampId) {
            this.ability.handleAbility(null, player, { ability: AbilityType.TORCH_RELIGHT });
          }
          return;
        }

        // Walk toward the unlit lamp
        if (player.weapon !== WeaponType.KATANA) player.weapon = WeaponType.KATANA;
        this.moveToward(botData, player, unlitLamp.x, unlitLamp.z, deltaMs, false);
        return;
      }
    }

    if (canSeeNinja) {
      // Cancel any channeling
      if (player.channelingLampId) {
        player.channelingLampId = null;
        player.channelingStartTime = 0;
      }

      // Switch weapon by distance: lance at medium, katana at close
      if (dSq > STATS.samurai.lanceRange * STATS.samurai.lanceRange) {
        if (player.weapon !== WeaponType.KATANA) player.weapon = WeaponType.KATANA;
      } else if (dSq > STATS.samurai.katanaRange * STATS.samurai.katanaRange) {
        if (player.weapon !== WeaponType.LANCE) player.weapon = WeaponType.LANCE;
      }

      const attackRange = player.weapon === WeaponType.LANCE
        ? STATS.samurai.lanceRange
        : STATS.samurai.katanaRange;

      if (dSq <= attackRange * attackRange) {
        this.faceTarget(player, ninja);
        this.combat.handleAttack(null, player);
      } else {
        this.moveToward(botData, player, ninja.x, ninja.z, deltaMs, true);
      }
    } else {
      // Patrol: prefer unlit lamps as waypoints
      if (player.weapon !== WeaponType.KATANA) player.weapon = WeaponType.KATANA;
      this.patrolToLamp(botData, player, deltaMs, true);
    }
  }

  // ── Shared helpers ─────────────────────────────────────────

  private faceTarget(player: PlayerState, target: PlayerState): void {
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    player.rotationY = Math.atan2(dx, dz);
  }

  private patrolToLamp(botData: BotData, player: PlayerState, deltaMs: number, preferUnlit: boolean): void {
    if (!botData.targetLampId) {
      botData.targetLampId = this.pickRandomLamp(preferUnlit);
    }
    if (!botData.targetLampId) return;

    const lamp = this.state.lamps.get(botData.targetLampId);
    if (!lamp) {
      botData.targetLampId = null;
      return;
    }

    const dSq = this.distSq(player.x, player.z, lamp.x, lamp.z);
    if (dSq < 3 * 3) {
      // Arrived at lamp, pick next
      botData.targetLampId = null;
      return;
    }

    this.moveToward(botData, player, lamp.x, lamp.z, deltaMs, false);
  }
}
