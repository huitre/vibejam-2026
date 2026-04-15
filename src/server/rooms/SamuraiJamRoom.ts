import { readFileSync } from "fs";
import { resolve } from "path";
import { Room, Client } from "@colyseus/core";
import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { CombatSystem } from "../systems/CombatSystem.js";
import { AbilitySystem } from "../systems/AbilitySystem.js";
import { LightingSystem } from "../systems/LightingSystem.js";
import { VisionSystem } from "../systems/VisionSystem.js";
import { WinConditionSystem } from "../systems/WinConditionSystem.js";
import { BotSystem } from "../systems/BotSystem.js";
import { GAME, STATS } from "../../shared/constants.js";
import { parseLevelJSON } from "../../shared/levelData.js";
import type { LampPosition } from "../systems/LightingSystem.js";
import { ClientMsg, ServerMsg, PlayerRole, GamePhase, WeaponType } from "../../shared/types.js";
import type { MovePayload, AttackPayload, UseAbilityPayload, SelectWeaponPayload } from "../../shared/messages.js";

const LEVEL_SCALE = 3;

export class SamuraiJamRoom extends Room<GameState> {
  maxClients = GAME.MAX_PLAYERS;

  private static roomCounter = 0;
  private displayName!: string;

  private physics!: PhysicsSystem;
  private combat!: CombatSystem;
  private ability!: AbilitySystem;
  private lighting!: LightingSystem;
  private vision!: VisionSystem;
  private winCondition!: WinConditionSystem;
  private botSystem!: BotSystem;

  private ninjaAssigned = false;
  private shogunAssigned = false;
  private samuraiCount = 0;
  private lastMetadataPhase = "";
  private spawnPositions: Record<string, { x: number; z: number }> = {};

  onCreate(_options: any): void {
    SamuraiJamRoom.roomCounter++;
    this.displayName = `Dojo #${SamuraiJamRoom.roomCounter}`;
    this.setState(new GameState());
    this.setMetadata({ roomName: this.displayName, phase: GamePhase.LOBBY, playerCount: 0 });

    // Load level JSON from disk
    const levelPath = resolve(process.cwd(), "public/map_pieces/level_1.json");
    const levelJSON = readFileSync(levelPath, "utf-8");
    const levelData = parseLevelJSON(levelJSON);

    // Scale colliders to match game world (editor units * LEVEL_SCALE)
    const colliders = levelData.colliders.map((c) => ({
      minX: c.minX * LEVEL_SCALE,
      minZ: c.minZ * LEVEL_SCALE,
      maxX: c.maxX * LEVEL_SCALE,
      maxZ: c.maxZ * LEVEL_SCALE,
      height: (c.height ?? 3) * LEVEL_SCALE,
    }));

    // Scale ramps to match game world
    const ramps = levelData.ramps.map((r) => ({
      minX: r.minX * LEVEL_SCALE,
      minZ: r.minZ * LEVEL_SCALE,
      maxX: r.maxX * LEVEL_SCALE,
      maxZ: r.maxZ * LEVEL_SCALE,
      startHeight: r.startHeight * LEVEL_SCALE,
      endHeight: r.endHeight * LEVEL_SCALE,
      direction: r.direction,
      ascending: r.ascending,
      rotationY: r.rotationY,
    }));

    // Scale spawn positions from level data
    for (const [role, pos] of Object.entries(levelData.spawns)) {
      this.spawnPositions[role] = { x: pos.x * LEVEL_SCALE, z: pos.z * LEVEL_SCALE };
    }

    // Extract lamp positions from "lantern" placements
    const lampPositions: LampPosition[] = levelData.placements
      .filter((p) => p.modelName === "lantern")
      .map((p, i) => ({
        id: `lamp_${String(i + 1).padStart(2, "0")}`,
        x: p.x * LEVEL_SCALE,
        z: p.z * LEVEL_SCALE,
      }));

    const boundsWidth = levelData.gridWidth * (levelData.cellSize ?? 1) * LEVEL_SCALE;
    const boundsDepth = levelData.gridDepth * (levelData.cellSize ?? 1) * LEVEL_SCALE;
    this.physics = new PhysicsSystem(colliders, boundsWidth, boundsDepth, ramps);
    this.lighting = new LightingSystem(this.state, lampPositions);
    this.combat = new CombatSystem(this.state, this.physics, this);
    this.ability = new AbilitySystem(this.state, this.physics, this.lighting, this);
    this.vision = new VisionSystem(this.state);
    this.winCondition = new WinConditionSystem(this.state, this);
    this.botSystem = new BotSystem(this.state, this.physics, this.combat, this.ability, this.lighting, this.vision);

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
        this.physics.applyMovement(player, data.dx, data.dz, data.rotationY, GAME.TICK_RATE_MS, !!data.sprint);
      } else if (player.isSprinting) {
        player.isSprinting = false;
        player.sprintStoppedAt = Date.now();
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
    this.setMetadata({ playerCount: this.state.players.size });
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
    this.setMetadata({ playerCount: this.state.players.size });
  }

  private update(deltaTime: number): void {
    // Track phase changes for metadata
    if (this.state.phase !== this.lastMetadataPhase) {
      this.lastMetadataPhase = this.state.phase;
      this.setMetadata({ phase: this.state.phase });
    }

    if (this.state.phase !== GamePhase.PLAYING) return;

    const now = Date.now();
    this.state.matchTimeRemaining = Math.max(0,
      (this.state.matchStartTime + GAME.MATCH_DURATION_SEC * 1000 - now) / 1000
    );

    this.botSystem.update(deltaTime);
    this.ability.updateProjectiles(deltaTime);
    this.ability.updateChanneling(now);
    this.ability.updateStealth();
    this.physics.updateStamina(this.state, deltaTime);
    this.winCondition.check(now);
  }

  private assignRole(player: PlayerState, role: PlayerRole): void {
    player.role = role;

    const defaultSpawns: Record<string, { x: number; z: number }> = {
      ninja: { x: 40, z: 50 },
      samurai: { x: 42, z: 50 },
      shogun: { x: 38, z: 50 },
    };
    const spawn = this.spawnPositions[role] ?? defaultSpawns[role];

    switch (role) {
      case PlayerRole.NINJA:
        player.maxHp = STATS.ninja.maxHp;
        player.hp = STATS.ninja.maxHp;
        player.weapon = WeaponType.KATANA;
        player.x = spawn.x; player.z = spawn.z; player.y = 0;
        player.waterBombsLeft = STATS.ninja.waterBombCount;
        player.smokeBombsLeft = STATS.ninja.smokeBombCount;
        player.hasGrapplingHook = true;
        player.stamina = STATS.ninja.maxStamina;
        player.maxStamina = STATS.ninja.maxStamina;
        player.caltropsLeft = STATS.ninja.caltropsCount;
        break;
      case PlayerRole.SAMURAI:
        player.maxHp = STATS.samurai.maxHp;
        player.hp = STATS.samurai.maxHp;
        player.weapon = WeaponType.KATANA;
        player.torchesLeft = STATS.samurai.torchCount;
        player.x = spawn.x; player.z = spawn.z; player.y = 0;
        player.stamina = STATS.samurai.maxStamina;
        player.maxStamina = STATS.samurai.maxStamina;
        break;
      case PlayerRole.SHOGUN:
        player.maxHp = STATS.shogun.maxHp;
        player.hp = STATS.shogun.maxHp;
        player.weapon = WeaponType.KATANA;
        player.x = spawn.x; player.z = spawn.z; player.y = 0;
        player.stamina = STATS.shogun.maxStamina;
        player.maxStamina = STATS.shogun.maxStamina;
        break;
    }
  }

  private checkStartConditions(): void {
    // Count only human players (non-bot)
    let humanCount = 0;
    this.state.players.forEach((p) => {
      if (!p.sessionId.startsWith("bot_")) humanCount++;
    });

    console.log(`[Room] checkStart: humans=${humanCount}, needed=${GAME.DEV_MIN_PLAYERS}, phase=${this.state.phase}`);
    if (humanCount >= GAME.DEV_MIN_PLAYERS && this.state.phase === GamePhase.LOBBY) {
      this.spawnBots();
      console.log("[Room] >>> GAME STARTING!");
      this.state.phase = GamePhase.PLAYING;
      this.state.matchStartTime = Date.now();
      this.state.matchTimeRemaining = GAME.MATCH_DURATION_SEC;
      this.broadcast(ServerMsg.GAME_START, { time: GAME.MATCH_DURATION_SEC });
    }
  }

  private spawnBots(): void {
    // Spawn shogun bot if no human shogun
    if (!this.shogunAssigned) {
      const bot = new PlayerState();
      bot.sessionId = "bot_shogun";
      this.assignRole(bot, PlayerRole.SHOGUN);
      this.state.players.set(bot.sessionId, bot);
      this.botSystem.spawnBot(bot);
      this.shogunAssigned = true;
      console.log(`[Room] Bot spawned: ${bot.sessionId} as ${bot.role}`);
    }

    // Spawn samurai bots for unfilled slots
    let botIdx = 0;
    while (this.samuraiCount < GAME.SAMURAI_COUNT) {
      const bot = new PlayerState();
      bot.sessionId = `bot_samurai_${++botIdx}`;
      this.assignRole(bot, PlayerRole.SAMURAI);
      this.state.players.set(bot.sessionId, bot);
      this.botSystem.spawnBot(bot);
      this.samuraiCount++;
      console.log(`[Room] Bot spawned: ${bot.sessionId} as ${bot.role}`);
    }
  }
}
