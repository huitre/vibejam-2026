import * as THREE from "three";
import { Room } from "colyseus.js";
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
import { GrapplingHookVisual } from "./abilities/GrapplingHookVisual.js";
import { CaltropVisual } from "./abilities/CaltropVisual.js";
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
  private grapplingHook!: GrapplingHookVisual;
  private caltropVisual!: CaltropVisual;
  private localPlayer!: LocalPlayer;
  private localSessionId = "";
  private localRole = "";
  private portalGroup!: THREE.Group;
  private portalRingMat!: THREE.MeshBasicMaterial;
  private portalRedirecting = false;

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private stateSync: StateSync | null = null;
  private debugPanel: DebugPanel | null = null;

  private static readonly PORTAL_POS = new THREE.Vector3(40, 0, 2);
  private static readonly PORTAL_RADIUS = 3;

  async start(): Promise<void> {
    // 1. Initialize Three.js
    this.sceneManager = new SceneManager();
    this.sceneManager.initialize();
    const scene = this.sceneManager.getScene();

    // 2. Build map + preload models (all in parallel)
    this.lighting = new LightingManager(scene);
    this.characters = new CharacterRenderer(scene);
    this.effects = new EffectRenderer(scene);
    this.caltropVisual = new CaltropVisual(scene);
    await Promise.all([
      MapBuilder.build(scene),
      this.lighting.loadModel(),
      this.characters.loadModel(),
      this.effects.loadModels(),
      this.caltropVisual.loadModel(),
    ]);
    this.weapons = new WeaponRenderer(this.characters);
    this.combat = new CombatVisuals(scene);
    this.healthBars = new HealthBar(scene);
    this.smokeBomb = new SmokeBombVisual(scene);
    this.smokeBomb.setCamera(this.sceneManager.getThirdPersonCamera().getCamera());
    this.waterBomb = new WaterBombVisual(scene);
    this.torchVisual = new TorchVisual(scene);
    this.chargeVisual = new ChargeVisual(scene);
    this.grapplingHook = new GrapplingHookVisual(scene);

    // 3. Build exit portal (Vibe Jam 2026)
    this.buildPortal(scene);

    // 4. Input
    this.inputManager = new InputManager();

    // 5. UI — shows RoomLobbyScreen by default
    this.ui = new UIManager();

    // 6. Network manager (no connection yet)
    this.network = new NetworkManager();

    // 7. Bind lobby callbacks
    const lobby = this.ui.getRoomLobby();
    lobby.onCreate(async () => {
      try {
        const room = await this.network.createRoom();
        this.onRoomJoined(room);
      } catch (err) {
        console.warn("[Game] Failed to create room:", err);
      }
    });
    lobby.onJoin(async (roomId: string) => {
      try {
        const room = await this.network.joinRoom(roomId);
        this.onRoomJoined(room);
      } catch (err) {
        console.warn("[Game] Failed to join room:", err);
        this.refreshRoomList();
      }
    });
    lobby.onQuickPlay(async () => {
      try {
        const room = await this.network.connect();
        this.onRoomJoined(room);
      } catch (err) {
        console.warn("[Game] Quick play failed:", err);
      }
    });

    // 8. Start polling room list
    this.startPolling();

    // 9. Start render loop (3D scene rotates behind overlay)
    this.sceneManager.startLoop((dt) => this.gameLoop(dt));
  }

  private startPolling(): void {
    this.refreshRoomList();
    this.pollingTimer = setInterval(() => this.refreshRoomList(), 3000);
  }

  private stopPolling(): void {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async refreshRoomList(): Promise<void> {
    try {
      const rooms = await this.network.getAvailableRooms();
      this.ui.getRoomLobby().updateRoomList(
        rooms.map((r) => ({
          roomId: r.roomId,
          metadata: r.metadata!,
          clients: r.clients,
          maxClients: r.maxClients,
        }))
      );
    } catch (err) {
      console.warn("[Game] Failed to fetch room list:", err);
    }
  }

  private onRoomJoined(room: Room): void {
    this.stopPolling();
    this.localSessionId = room.sessionId;

    // Switch to RoleSelectScreen
    this.ui.onPhaseChange(GamePhase.LOBBY);

    // Input sender
    this.inputSender = new InputSender(room);

    const scene = this.sceneManager.getScene();

    // Listen for server messages
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
        case AbilityType.GRAPPLING_HOOK:
          this.grapplingHook.launch(
            data.casterSessionId,
            data.startX, data.startZ,
            data.wallX, data.wallZ, data.wallY,
          );
          break;
        case AbilityType.TORCH_RELIGHT_START:
          this.lighting.startRelighting(data.lampId, data.duration);
          break;
        case AbilityType.TORCH_RELIGHT_CANCEL:
          this.lighting.cancelRelighting(data.lampId);
          break;
        case AbilityType.TORCH_RELIGHT:
          this.lighting.completeRelighting(data.lampId);
          break;
        case AbilityType.CALTROPS:
          this.caltropVisual.createCaltrops(data.x, data.z, data.radius, data.duration);
          break;
      }
    });

    room.onMessage(ServerMsg.GAME_OVER, (data: any) => {
      this.ui.showGameOver(data.winner);
    });

    // State sync
    this.stateSync = new StateSync(room, {
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

        const entity = this.characters.getEntity(sessionId);
        if (entity && player.weapon !== entity.currentWeapon) {
          entity.currentWeapon = player.weapon;
          this.weapons.updateWeapon(sessionId, player.weapon);
        }

        if (entity && !player.alive && !entity.dead) {
          this.characters.playDeath(sessionId);
          this.weapons.removeWeapon(sessionId);
          this.healthBars.removeBar(sessionId);
        }

        if (entity) {
          if (player.isStunned && !entity.stunGroup) {
            this.characters.startStun(sessionId);
          } else if (!player.isStunned && entity.stunGroup) {
            this.characters.endStun(sessionId);
          }

          if (player.role === PlayerRole.NINJA) {
            this.characters.setStealth(sessionId, player.isInStealth);
          }
        }

        if (this.localPlayer && sessionId === this.localSessionId) {
          this.localPlayer.entity.updateFromState(player);
          this.ui.updateHUD(player.hp, player.maxHp, (room.state as any).matchTimeRemaining, player.stamina, player.maxStamina);

          if (player.role === "samurai") {
            this.ui.updateTorchCount(player.torchesLeft);
          }

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
    this.stateSync.listen();

    // React to phase changes
    let lastPhase = "";
    room.onStateChange(() => {
      const phase = (room.state as any).phase as string;
      if (phase && phase !== lastPhase) {
        lastPhase = phase;
        this.ui.onPhaseChange(phase);
      }
    });

    // Debug panel
    this.debugPanel = new DebugPanel(this.weapons, this.inputSender);

    // Ready button
    this.ui.onReady(() => {
      this.inputSender.sendReady();
    });

    // Return to lobby from game over
    this.ui.getGameOver().onReturn(() => {
      this.returnToLobby();
    });
  }

  private returnToLobby(): void {
    // Disconnect from current room
    this.network.disconnect();

    // Clean up all entities
    this.characters.removeAll();
    this.healthBars.removeAll();
    this.weapons.removeAll();

    // Reset local state
    this.localPlayer = null!;
    this.localSessionId = "";
    this.localRole = "";
    this.stateSync = null;

    // Show room lobby
    this.ui.showRoomLobby();

    // Restart polling
    this.startPolling();
  }

  private gameLoop(deltaMs: number): void {
    if (this.localPlayer) {
      const yaw = this.sceneManager.getThirdPersonCamera().getYaw();
      const localEntity = this.characters.getEntity(this.localSessionId);
      const px = localEntity ? localEntity.group.position.x : 0;
      const pz = localEntity ? localEntity.group.position.z : 0;
      this.localPlayer.update(deltaMs, yaw, px, pz);

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
    this.caltropVisual.update(deltaMs);

    // Update grappling hook animation (follow caster entity)
    if (this.grapplingHook.isActive()) {
      const casterId = this.grapplingHook.getActiveCaster();
      const casterEntity = casterId ? this.characters.getEntity(casterId) : null;
      this.grapplingHook.update(deltaMs, casterEntity ? casterEntity.group : null);
    }

    this.healthBars.updateBillboards(this.sceneManager.getThirdPersonCamera().getCamera());

    if (localEntity) {
      this.lighting.updateShadowBudget(localEntity.group.position);
      const p = localEntity.group.position;
      this.ui.updateDebugCoords(p.x, p.y, p.z, localEntity.currentRot);

      // Portal proximity check
      this.checkPortalProximity(p);
    }

    // Animate portal glow
    this.updatePortal();
  }

  private buildPortal(scene: THREE.Scene): void {
    const pos = Game.PORTAL_POS;
    this.portalGroup = new THREE.Group();
    this.portalGroup.position.set(pos.x, pos.y, pos.z);

    // Torii gate pillars
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 8);
    const pillarMat = new THREE.MeshToonMaterial({ color: 0xcc2222 });
    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-1.5, 2, 0);
    this.portalGroup.add(leftPillar);
    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(1.5, 2, 0);
    this.portalGroup.add(rightPillar);

    // Top beam
    const beamGeo = new THREE.BoxGeometry(4, 0.3, 0.3);
    const beamMat = new THREE.MeshToonMaterial({ color: 0xcc2222 });
    const topBeam = new THREE.Mesh(beamGeo, beamMat);
    topBeam.position.set(0, 4, 0);
    this.portalGroup.add(topBeam);

    // Glowing inner ring (portal effect)
    const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 32);
    this.portalRingMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.7 });
    const ring = new THREE.Mesh(ringGeo, this.portalRingMat);
    ring.position.set(0, 2.2, 0);
    ring.name = "portalRing";
    this.portalGroup.add(ring);

    // Portal light
    const portalLight = new THREE.PointLight(0x4488ff, 2, 8);
    portalLight.position.set(0, 2.2, 0);
    this.portalGroup.add(portalLight);

    scene.add(this.portalGroup);
  }

  private updatePortal(): void {
    const ring = this.portalGroup.getObjectByName("portalRing");
    if (ring) {
      ring.rotation.z = performance.now() * 0.001;
      this.portalRingMat.opacity = 0.5 + Math.sin(performance.now() * 0.003) * 0.3;
    }
  }

  private checkPortalProximity(playerPos: THREE.Vector3): void {
    if (this.portalRedirecting) return;
    const dx = playerPos.x - Game.PORTAL_POS.x;
    const dz = playerPos.z - Game.PORTAL_POS.z;
    if (dx * dx + dz * dz < Game.PORTAL_RADIUS * Game.PORTAL_RADIUS) {
      this.portalRedirecting = true;
      window.location.href = "https://vibej.am/portal/2026";
    }
  }
}
