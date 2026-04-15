import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { STATS } from "../../shared/constants.js";
import { PlayerRole, ServerMsg, WeaponType } from "../../shared/types.js";
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
      // Samurai
      if (player.weapon === WeaponType.LANCE) {
        damage = STATS.samurai.lanceDamage;
        range = STATS.samurai.lanceRange;
      } else {
        damage = STATS.samurai.katanaDamage;
        range = STATS.samurai.katanaRange;
      }
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

      // Check role-based targeting:
      // Ninja can attack samurai and shogun
      // Samurai and shogun can attack ninja
      const isNinjaAttacking = player.role === PlayerRole.NINJA;
      const isTargetNinja = target.role === PlayerRole.NINJA;

      if (isNinjaAttacking && isTargetNinja) continue;
      if (!isNinjaAttacking && !isTargetNinja) continue;

      // Apply armor reduction for samurai
      let finalDamage = damage;
      if (target.role === PlayerRole.SAMURAI) {
        finalDamage = Math.round(damage * (1 - STATS.samurai.armorReduction));
      }

      target.hp = Math.max(0, target.hp - finalDamage);

      this.room.broadcast(ServerMsg.PLAYER_HIT, {
        x: target.x,
        y: target.y,
        z: target.z,
      });

      if (target.hp <= 0) {
        target.alive = false;
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
}
