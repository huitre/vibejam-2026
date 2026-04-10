import { SceneManager } from "./render/SceneManager.js";
import { CharacterRenderer } from "./render/CharacterRenderer.js";
import { WeaponRenderer } from "./render/WeaponRenderer.js";
import { EffectRenderer } from "./render/EffectRenderer.js";
import { LightingManager } from "./lighting/LightingManager.js";
import { MapBuilder } from "./maps/MapBuilder.js";
import { NetworkManager } from "./network/NetworkManager.js";
import { StateSync } from "./network/StateSync.js";
import { InputSender } from "./network/InputSender.js";
import { InputManager } from "./input/InputManager.js";
import { UIManager } from "./ui/UIManager.js";
import { CombatVisuals } from "./combat/CombatVisuals.js";
import { HealthBar } from "./combat/HealthBar.js";
import { SmokeBombVisual } from "./abilities/SmokeBombVisual.js";
import { WaterBombVisual } from "./abilities/WaterBombVisual.js";
import { TorchVisual } from "./abilities/TorchVisual.js";
import { ChargeVisual } from "./abilities/ChargeVisual.js";
import { LocalPlayer } from "./entities/LocalPlayer.js";
import { DebugPanel } from "./ui/DebugPanel.js";
import { ServerMsg, PlayerRole, AbilityType, GamePhase } from "../shared/types.js";
import { GAME } from "../shared/constants.js";

export class Game {
  private sceneManager!: SceneManager;
  private characters!: CharacterRenderer;
  private weapons!: WeaponRenderer;
  private effects!: EffectRenderer;
  private lighting!: LightingManager;
  private network!: NetworkManager;
  private inputManager!: InputManager;
  private inputSender!: InputSender;
  private ui!: UIManager;
  private combat!: CombatVisuals;
  private healthBars!: HealthBar;
  private smokeBomb!: SmokeBombVisual;
  private waterBomb!: WaterBombVisual;
  private torchVisual!: TorchVisual;
  private chargeVisual!: ChargeVisual;
  private localPlayer!: LocalPlayer;
  private localSessionId = "";
  private localRole = "";

  async start(): Promise<void> {
    // 1. Initialize Three.js
    this.sceneManager = new SceneManager();
    this.sceneManager.initialize();
    const scene = this.sceneManager.getScene();

    // 2. Build map + preload models (all in parallel)
    this.lighting = new LightingManager(scene);
    this.characters = new CharacterRenderer(scene);
    this.effects = new EffectRenderer(scene);
    await Promise.all([
      MapBuilder.build(scene),
      this.lighting.loadModel(),
      this.characters.loadModel(),
      this.effects.loadModels(),
    ]);
    this.weapons = new WeaponRenderer(this.characters);
    this.combat = new CombatVisuals(scene);
    this.healthBars = new HealthBar(scene);
    this.smokeBomb = new SmokeBombVisual(scene);
    this.smokeBomb.setCamera(this.sceneManager.getThirdPersonCamera().getCamera());
    this.waterBomb = new WaterBombVisual(scene);
    this.torchVisual = new TorchVisual(scene);
    this.chargeVisual = new ChargeVisual(scene);

    // 4. Input
    this.inputManager = new InputManager();

    // 5. UI
    this.ui = new UIManager();

    // 6. Connect to server
    this.network = new NetworkManager();
    const room = await this.network.connect();
    this.localSessionId = room.sessionId;

    // 7. Input sender
    this.inputSender = new InputSender(room);

    // 8. Listen for server messages
    room.onMessage(ServerMsg.ROLE_ASSIGNED, (data: { role: string }) => {
      this.localRole = data.role;
      this.ui.setRole(data.role);
      this.localPlayer = new LocalPlayer(
        this.localSessionId, data.role,
        this.inputManager, this.inputSender,
        scene,
      );
      this.localPlayer.onWindUp(() => {
        this.weapons.startWindUp(this.localSessionId);
      });
      this.localPlayer.onCancelWindUp(() => {
        this.weapons.cancelWindUp(this.localSessionId);
      });
      this.localPlayer.onAttack(() => {
        const entity = this.characters.getEntity(this.localSessionId);
        if (entity) {
          const pos = entity.group.position;
          const swingHandle = this.weapons.playSwing(this.localSessionId);
          this.combat.showSlash(pos.x, pos.y, pos.z, entity.currentRot, swingHandle);
        }
      });
    });

    room.onMessage(ServerMsg.GAME_START, () => {
      this.ui.onPhaseChange(GamePhase.PLAYING);
    });

    room.onMessage(ServerMsg.ATTACK_RESULT, (data: any) => {
      // Remote players' attacks (local player already shows slash immediately)
      const attacker = this.characters.getEntity(data.attackerSessionId);
      if (attacker) {
        const pos = attacker.group.position;
        const swingHandle = this.weapons.playSwing(data.attackerSessionId);
        this.combat.showSlash(pos.x, pos.y, pos.z, attacker.currentRot, swingHandle);
      }
    });

    room.onMessage(ServerMsg.PLAYER_HIT, (data: any) => {
      this.combat.showHitSparks(data.x, data.y ?? 0, data.z);
    });

    room.onMessage(ServerMsg.ABILITY_EFFECT, (data: any) => {
      switch (data.ability) {
        case AbilityType.SMOKE_BOMB:
          this.smokeBomb.createCloud(data.x, data.z, data.radius || 5, data.duration || 6000);
          break;
        case AbilityType.WATER_BOMB:
          this.waterBomb.createSplash(data.x, data.z);
          break;
        case AbilityType.SHOGUN_CHARGE: {
          const charger = this.characters.getEntity(data.casterSessionId);
          if (charger) {
            const cpos = charger.group.position;
            this.chargeVisual.showCharge(cpos.x, cpos.z, data.x, data.z);
          }
          break;
        }
        case AbilityType.TORCH_RELIGHT_START:
          this.lighting.startRelighting(data.lampId, data.duration);
          break;
        case AbilityType.TORCH_RELIGHT_CANCEL:
          this.lighting.cancelRelighting(data.lampId);
          break;
        case AbilityType.TORCH_RELIGHT:
          this.lighting.completeRelighting(data.lampId);
          break;
      }
    });

    room.onMessage(ServerMsg.GAME_OVER, (data: any) => {
      this.ui.showGameOver(data.winner);
    });

    // 9. State sync
    const stateSync = new StateSync(room, {
      onPlayerAdded: (sessionId, player) => {
        this.characters.addPlayer(sessionId, player.role, player.x, player.y, player.z);
        const entity = this.characters.getEntity(sessionId);
        if (entity) {
          this.healthBars.addBar(sessionId, entity.group);
          entity.currentWeapon = player.weapon;
          this.weapons.updateWeapon(sessionId, player.weapon);
        }
        const playerCount = (room.state as any).players.size;
        this.ui.setPlayerCount(playerCount);
        if (playerCount >= GAME.DEV_MIN_PLAYERS) {
          this.ui.showReadyButton();
        }
      },
      onPlayerRemoved: (sessionId) => {
        this.characters.removePlayer(sessionId);
        this.healthBars.removeBar(sessionId);
        this.weapons.removeWeapon(sessionId);
        const playerCount = (room.state as any).players.size;
        this.ui.setPlayerCount(playerCount);
        if (playerCount < GAME.DEV_MIN_PLAYERS) {
          this.ui.hideReadyButton();
        }
      },
      onPlayerChanged: (sessionId, player) => {
        this.characters.updatePlayer(sessionId, player.x, player.y, player.z, player.rotationY);
        this.healthBars.updateBar(sessionId, player.hp, player.maxHp);

        // Detect weapon change and update visual
        const entity = this.characters.getEntity(sessionId);
        if (entity && player.weapon !== entity.currentWeapon) {
          entity.currentWeapon = player.weapon;
          this.weapons.updateWeapon(sessionId, player.weapon);
        }

        // Death animation
        if (entity && !player.alive && !entity.dead) {
          this.characters.playDeath(sessionId);
          this.weapons.removeWeapon(sessionId);
          this.healthBars.removeBar(sessionId);
        }

        // Stun stars
        if (entity) {
          if (player.isStunned && !entity.stunGroup) {
            this.characters.startStun(sessionId);
          } else if (!player.isStunned && entity.stunGroup) {
            this.characters.endStun(sessionId);
          }
        }

        if (this.localPlayer && sessionId === this.localSessionId) {
          this.localPlayer.entity.updateFromState(player);
          this.ui.updateHUD(player.hp, player.maxHp, (room.state as any).matchTimeRemaining);

          // Update torch counter for samurai
          if (player.role === "samurai") {
            this.ui.updateTorchCount(player.torchesLeft);
          }

          // Cancel aiming/wind-up if stunned or dead
          if (player.isStunned || !player.alive) {
            this.localPlayer.cancelBomb();
            this.localPlayer.cancelWindUp();
          }
        }
      },
      onLampAdded: (lampId, lamp) => {
        this.lighting.addLamp(lampId, lamp.x, lamp.y, lamp.z, lamp.lit);
      },
      onLampChanged: (lampId, lit) => {
        this.lighting.setLampState(lampId, lit);
      },
      onProjectileAdded: (id, proj) => {
        this.effects.addProjectile(id, proj);
      },
      onProjectileRemoved: (id) => {
        this.effects.removeProjectile(id);
      },
    });
    stateSync.listen();

    // React to phase changes (handles both late-join and normal GAME_START)
    let lastPhase = "";
    room.onStateChange(() => {
      const phase = (room.state as any).phase as string;
      if (phase && phase !== lastPhase) {
        lastPhase = phase;
        this.ui.onPhaseChange(phase);
      }
    });

    // 10. Debug panel
    new DebugPanel(this.weapons, this.inputSender);

    // 11. Ready button
    this.ui.onReady(() => {
      this.inputSender.sendReady();
    });

    // 11. Start game loop
    this.sceneManager.startLoop((dt) => this.gameLoop(dt));
  }

  private gameLoop(deltaMs: number): void {
    if (this.localPlayer) {
      const yaw = this.sceneManager.getThirdPersonCamera().getYaw();
      const localEntity = this.characters.getEntity(this.localSessionId);
      const px = localEntity ? localEntity.group.position.x : 0;
      const pz = localEntity ? localEntity.group.position.z : 0;
      this.localPlayer.update(deltaMs, yaw, px, pz);

      // Update bomb selection HUD
      const selected = this.localPlayer.getSelectedBomb();
      if (selected) {
        this.ui.showBombSelected(selected);
      } else {
        this.ui.hideBombSelected();
      }
    }

    const localEntity = this.characters.getEntity(this.localSessionId);
    if (localEntity) {
      this.sceneManager.getThirdPersonCamera().followTarget(localEntity.group.position);
    }

    this.characters.interpolateAll();
    this.weapons.updateTorchFlicker();

    this.combat.update(deltaMs);
    this.effects.update(deltaMs);
    this.smokeBomb.update(deltaMs);
    this.waterBomb.update(deltaMs);
    this.torchVisual.update(deltaMs);
    this.chargeVisual.update(deltaMs);

    this.healthBars.updateBillboards(this.sceneManager.getThirdPersonCamera().getCamera());

    if (localEntity) {
      this.lighting.updateShadowBudget(localEntity.group.position);
      const p = localEntity.group.position;
      this.ui.updateDebugCoords(p.x, p.y, p.z, localEntity.currentRot);
    }
  }
}
