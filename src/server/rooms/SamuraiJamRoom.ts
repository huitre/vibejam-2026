import { Room, Client } from "@colyseus/core";
import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { CombatSystem } from "../systems/CombatSystem.js";
import { AbilitySystem } from "../systems/AbilitySystem.js";
import { LightingSystem } from "../systems/LightingSystem.js";
import { VisionSystem } from "../systems/VisionSystem.js";
import { WinConditionSystem } from "../systems/WinConditionSystem.js";
import { GAME, STATS } from "../../shared/constants.js";
import { ClientMsg, ServerMsg, PlayerRole, GamePhase, WeaponType } from "../../shared/types.js";
import type { MovePayload, AttackPayload, UseAbilityPayload, SelectWeaponPayload } from "../../shared/messages.js";

export class SamuraiJamRoom extends Room<GameState> {
  maxClients = GAME.MAX_PLAYERS;

  private physics!: PhysicsSystem;
  private combat!: CombatSystem;
  private ability!: AbilitySystem;
  private lighting!: LightingSystem;
  private vision!: VisionSystem;
  private winCondition!: WinConditionSystem;

  private ninjaAssigned = false;
  private shogunAssigned = false;
  private samuraiCount = 0;

  onCreate(_options: any): void {
    this.setState(new GameState());

    this.physics = new PhysicsSystem();
    this.lighting = new LightingSystem(this.state);
    this.combat = new CombatSystem(this.state, this.physics, this);
    this.ability = new AbilitySystem(this.state, this.physics, this.lighting, this);
    this.vision = new VisionSystem(this.state);
    this.winCondition = new WinConditionSystem(this.state, this);

    this.lighting.initializeLamps();

    // Register message handlers
    this.onMessage(ClientMsg.MOVE, (client, data: MovePayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.isStunned || player.isClimbing) return;
      if (this.state.phase !== GamePhase.PLAYING) return;
      // Always update facing direction from camera yaw
      player.rotationY = data.rotationY;
      // Only apply movement if there's actual input
      if (data.dx !== 0 || data.dz !== 0) {
        this.physics.applyMovement(player, data.dx, data.dz, data.rotationY, GAME.TICK_RATE_MS);
      }
    });

    this.onMessage(ClientMsg.ATTACK, (client, _data: AttackPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.isStunned) return;
      if (this.state.phase !== GamePhase.PLAYING) return;
      this.combat.handleAttack(client, player);
    });

    this.onMessage(ClientMsg.USE_ABILITY, (client, data: UseAbilityPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (this.state.phase !== GamePhase.PLAYING) return;
      this.ability.handleAbility(client, player, data);
    });

    this.onMessage(ClientMsg.SELECT_WEAPON, (client, data: SelectWeaponPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.role !== PlayerRole.SAMURAI) return;
      if (data.weapon === WeaponType.KATANA || data.weapon === WeaponType.LANCE || data.weapon === WeaponType.TORCH) {
        player.weapon = data.weapon;
      }
    });

    this.onMessage(ClientMsg.DEBUG_NOCLIP, (client) => {
      this.physics.toggleNoclip(client.sessionId);
    });

    this.onMessage(ClientMsg.READY, (client) => {
      console.log(`[Room] READY received from ${client.sessionId}, players: ${this.state.players.size}/${GAME.DEV_MIN_PLAYERS}`);
      this.checkStartConditions();
    });

    // Simulation loop
    this.setSimulationInterval((deltaTime) => {
      this.update(deltaTime);
    }, GAME.TICK_RATE_MS);

    this.setPatchRate(GAME.TICK_RATE_MS);
  }

  onJoin(client: Client, _options: any): void {
    const player = new PlayerState();
    player.sessionId = client.sessionId;

    // Assign ninja first, then shogun second, then samurais
    if (!this.ninjaAssigned) {
      this.assignRole(player, PlayerRole.NINJA);
      this.ninjaAssigned = true;
    } else if (!this.shogunAssigned) {
      this.assignRole(player, PlayerRole.SHOGUN);
      this.shogunAssigned = true;
    } else if (this.samuraiCount < GAME.SAMURAI_COUNT) {
      this.assignRole(player, PlayerRole.SAMURAI);
      this.samuraiCount++;
    }

    this.state.players.set(client.sessionId, player);
    client.send(ServerMsg.ROLE_ASSIGNED, { role: player.role });
    console.log(`[Room] Player joined: ${client.sessionId} as ${player.role} (total: ${this.state.players.size})`);
  }

  onLeave(client: Client, _consented: boolean): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      if (player.role === PlayerRole.NINJA) this.ninjaAssigned = false;
      else if (player.role === PlayerRole.SHOGUN) this.shogunAssigned = false;
      else this.samuraiCount--;
    }
    this.state.players.delete(client.sessionId);
  }

  private update(deltaTime: number): void {
    if (this.state.phase !== GamePhase.PLAYING) return;

    const now = Date.now();
    this.state.matchTimeRemaining = Math.max(0,
      (this.state.matchStartTime + GAME.MATCH_DURATION_SEC * 1000 - now) / 1000
    );

    this.ability.updateProjectiles(deltaTime);
    this.ability.updateChanneling(now);
    this.winCondition.check(now);
  }

  private assignRole(player: PlayerState, role: PlayerRole): void {
    player.role = role;

    switch (role) {
      case PlayerRole.NINJA:
        player.maxHp = STATS.ninja.maxHp;
        player.hp = STATS.ninja.maxHp;
        player.weapon = WeaponType.KATANA;
        player.x = 40; player.z = 50; player.y = 0;
        player.waterBombsLeft = STATS.ninja.waterBombCount;
        player.smokeBombsLeft = STATS.ninja.smokeBombCount;
        player.hasGrapplingHook = true;
        break;
      case PlayerRole.SAMURAI:
        player.maxHp = STATS.samurai.maxHp;
        player.hp = STATS.samurai.maxHp;
        player.weapon = WeaponType.KATANA;
        player.torchesLeft = STATS.samurai.torchCount;
        player.x = 42; player.z = 50; player.y = 0;
        break;
      case PlayerRole.SHOGUN:
        player.maxHp = STATS.shogun.maxHp;
        player.hp = STATS.shogun.maxHp;
        player.weapon = WeaponType.KATANA;
        player.x = 38; player.z = 50; player.y = 0;
        break;
    }
  }

  private checkStartConditions(): void {
    console.log(`[Room] checkStart: players=${this.state.players.size}, needed=${GAME.DEV_MIN_PLAYERS}, phase=${this.state.phase}`);
    if (this.state.players.size >= GAME.DEV_MIN_PLAYERS && this.state.phase === GamePhase.LOBBY) {
      console.log("[Room] >>> GAME STARTING!");
      this.state.phase = GamePhase.PLAYING;
      this.state.matchStartTime = Date.now();
      this.state.matchTimeRemaining = GAME.MATCH_DURATION_SEC;
      this.broadcast(ServerMsg.GAME_START, { time: GAME.MATCH_DURATION_SEC });
    }
  }
}
