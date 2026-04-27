import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { STATS } from "../../shared/constants.js";
import { AbilityType, PlayerRole, ServerMsg, WeaponType } from "../../shared/types.js";
import type { Client, Room } from "@colyseus/core";

export class CombatSystem {
  constructor(
    private state: GameState,
    private physics: PhysicsSystem,
    private room: Room,
  ) {}

  handleAttack(client: Client | null, player: PlayerState): void {
    const now = Date.now();
    const stats = STATS[player.role as keyof typeof STATS];
    const cooldown = ('attackCooldownMs' in stats) ? stats.attackCooldownMs : 800;

    // Torch cannot attack
    if (player.role === PlayerRole.SAMURAI && player.weapon === WeaponType.TORCH) return;

    if (now - player.lastAttackTime < cooldown) return;
    player.lastAttackTime = now;
    player.isAttacking = true;

    // Broadcast attack visual to all clients (except attacker who shows it locally)
    this.room.broadcast(ServerMsg.ATTACK_RESULT, {
      attackerSessionId: player.sessionId,
    }, client ? { except: client } : undefined);

    // Determine weapon stats
    let damage: number;
    let range: number;

    if (player.role === PlayerRole.NINJA) {
      damage = STATS.ninja.attackDamage;
      range = STATS.ninja.attackRange;
    } else if (player.role === PlayerRole.SHOGUN) {
      damage = STATS.shogun.attackDamage;
      range = STATS.shogun.attackRange;
    } else {
      // Samurai — lance only
      damage = STATS.samurai.lanceDamage;
      range = STATS.samurai.lanceRange;
    }

    // Get facing direction
    const dirX = Math.sin(player.rotationY);
    const dirZ = Math.cos(player.rotationY);

    // Find targets in attack cone (60 degree arc)
    const targets = this.physics.getPlayersInCone(
      this.state, player.x, player.z,
      dirX, dirZ, range, Math.PI / 6
    );

    for (const target of targets) {
      if (target.sessionId === player.sessionId) continue;

      // Invisible ninja: in smoke → unhittable; in stealth → only hittable at melee range
      if (target.role === PlayerRole.NINJA && player.role !== PlayerRole.NINJA) {
        if (target.isInSmoke) continue;
        if (target.isInStealth) {
          const dx = target.x - player.x;
          const dz = target.z - player.z;
          if (dx * dx + dz * dz > 3 * 3) continue;
        }
      }

      // Invulnerability check (shadow dash / kawarimi)
      if (now < target.invulnerableUntil) continue;

      // Kawarimi substitution: ninja teleports to checkpoint, skip damage
      if (target.hasKawariminCheckpoint && target.role === PlayerRole.NINJA) {
        this.triggerKawarimi(target, now);
        continue;
      }

      // Check role-based targeting:
      // Ninja can attack samurai and shogun
      // Samurai and shogun can attack ninja
      const isNinjaAttacking = player.role === PlayerRole.NINJA;
      const isTargetNinja = target.role === PlayerRole.NINJA;

      if (isNinjaAttacking && isTargetNinja) continue;
      if (!isNinjaAttacking && !isTargetNinja) continue;

      // Backstab: ninja attacks target from behind (>90° from target's facing)
      let finalDamage = damage;
      if (isNinjaAttacking) {
        const toTargetX = target.x - player.x;
        const toTargetZ = target.z - player.z;
        const targetFacingX = Math.sin(target.rotationY);
        const targetFacingZ = Math.cos(target.rotationY);
        // dot > 0 means attacker is behind the target
        const dot = toTargetX * targetFacingX + toTargetZ * targetFacingZ;
        if (dot > 0) {
          finalDamage = Math.round(damage * STATS.ninja.backstabMultiplier);
        }
      }

      // Check blocking: target blocks frontal attacks (±22.5° cone)
      if (target.isBlocking) {
        // Direction from target to attacker
        const toAttackerX = player.x - target.x;
        const toAttackerZ = player.z - target.z;
        const dist = Math.sqrt(toAttackerX * toAttackerX + toAttackerZ * toAttackerZ);
        if (dist > 0.001) {
          const targetFacingX = Math.sin(target.rotationY);
          const targetFacingZ = Math.cos(target.rotationY);
          // Dot product: positive means attacker is in front of target
          const dot = (toAttackerX / dist) * targetFacingX + (toAttackerZ / dist) * targetFacingZ;
          // cos(22.5°) ≈ 0.924 → block if attacker is within ±22.5° of facing
          if (dot > 0.924) {
            // Attack blocked!
            this.room.broadcast(ServerMsg.PLAYER_BLOCK, {
              x: target.x,
              y: target.y,
              z: target.z,
            });
            continue;
          }
        }
      }

      // Apply armor reduction for samurai
      if (target.role === PlayerRole.SAMURAI) {
        finalDamage = Math.round(finalDamage * (1 - STATS.samurai.armorReduction));
      }

      target.hp = Math.max(0, target.hp - finalDamage);

      this.room.broadcast(ServerMsg.PLAYER_HIT, {
        x: target.x,
        y: target.y,
        z: target.z,
        backstab: isNinjaAttacking && finalDamage > damage,
      });

      if (target.hp <= 0) {
        target.alive = false;
        player.kills++;
        target.deaths++;
        this.room.broadcast(ServerMsg.PLAYER_KILLED, {
          sessionId: target.sessionId,
          killerSessionId: player.sessionId,
        });
      }
    }

    // Reset isAttacking after 300ms
    setTimeout(() => {
      player.isAttacking = false;
    }, 300);
  }

  private triggerKawarimi(target: PlayerState, now: number): void {
    const origX = target.x;
    const origZ = target.z;

    // Teleport to checkpoint
    target.x = target.kawariminCheckpointX;
    target.z = target.kawariminCheckpointZ;

    // Reset checkpoint
    target.hasKawariminCheckpoint = false;

    // Post-teleport invulnerability and cooldown
    target.invulnerableUntil = now + STATS.ninja.kawariminInvulnMs;
    target.kawariminCooldownUntil = now + STATS.ninja.kawariminCooldownMs;

    // Broadcast trigger effect (log + smoke at original position)
    this.room.broadcast(ServerMsg.ABILITY_EFFECT, {
      ability: AbilityType.KAWARIMI_TRIGGER,
      casterSessionId: target.sessionId,
      origX,
      origZ,
      tpX: target.x,
      tpZ: target.z,
    });
  }
}
