import * as THREE from "three";
import { PlayerEntity } from "./PlayerEntity.js";
import { InputManager } from "../input/InputManager.js";
import { InputSender } from "../network/InputSender.js";
import { SWING_CONFIG } from "../render/WeaponRenderer.js";
import { BombAimIndicator } from "../abilities/BombAimIndicator.js";
import { AbilityType, PlayerRole } from "../../shared/types.js";
import { STATS } from "../../shared/constants.js";

const AIM_MIN_DIST = 2;
const AIM_MAX_DIST = STATS.ninja.bombMaxThrowDist;
const AIM_RAMP_MS = 1500;

export type BombKind = "water_bomb" | "smoke_bomb" | null;

export class LocalPlayer {
  entity: PlayerEntity;
  private input: InputManager;
  private sender: InputSender;
  private attackCallback?: () => void;
  private windUpCallback?: () => void;
  private cancelWindUpCallback?: () => void;
  private attackCooldown = 0;
  private isWindingUp = false;

  // Bomb aiming state
  private selectedBomb: BombKind = null;
  private isAiming = false;
  private aimHoldTimeMs = 0;
  private aimIndicator: BombAimIndicator;

  constructor(sessionId: string, role: string, input: InputManager, sender: InputSender, scene: THREE.Scene) {
    this.entity = new PlayerEntity(sessionId, role, true);
    this.input = input;
    this.sender = sender;
    this.aimIndicator = new BombAimIndicator(scene);
  }

  onAttack(cb: () => void): void {
    this.attackCallback = cb;
  }

  onWindUp(cb: () => void): void {
    this.windUpCallback = cb;
  }

  onCancelWindUp(cb: () => void): void {
    this.cancelWindUpCallback = cb;
  }

  update(deltaMs: number, cameraYaw: number, playerWorldX: number, playerWorldZ: number): void {
    const bindings = this.input.getBindings();
    const moveDir = this.input.getMovementDirection();
    const isMoving = moveDir.dx !== 0 || moveDir.dz !== 0;
    const wantsSprint = this.input.isPressed(bindings.sprint) && isMoving;
    this.sender.update(deltaMs, moveDir, cameraYaw, wantsSprint);

    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaMs);
    }

    // --- Ninja bomb selection (E = water, R = smoke) ---
    if (this.entity.role === PlayerRole.NINJA) {
      if (this.input.wasJustPressed(bindings.ability2)) {
        if (this.selectedBomb === "water_bomb") {
          this.cancelBomb();
        } else {
          this.cancelAiming();
          this.selectedBomb = "water_bomb";
        }
      }

      if (this.input.wasJustPressed(bindings.ability3)) {
        if (this.selectedBomb === "smoke_bomb") {
          this.cancelBomb();
        } else {
          this.cancelAiming();
          this.selectedBomb = "smoke_bomb";
        }
      }
    }

    // --- Bomb aiming (hold left click while bomb selected) ---
    if (this.selectedBomb) {
      // Start aiming on click
      if (this.input.wasJustPressed(bindings.attack)) {
        this.isAiming = true;
        this.aimHoldTimeMs = 0;
        this.aimIndicator.show(this.selectedBomb);
      }

      // Update aim while holding
      if (this.isAiming && this.input.isPressed(bindings.attack)) {
        this.aimHoldTimeMs += deltaMs;
        const t = Math.min(1, this.aimHoldTimeMs / AIM_RAMP_MS);
        const dist = AIM_MIN_DIST + (AIM_MAX_DIST - AIM_MIN_DIST) * t;

        const aimX = playerWorldX + Math.sin(cameraYaw) * dist;
        const aimZ = playerWorldZ + Math.cos(cameraYaw) * dist;
        this.aimIndicator.updatePosition(aimX, aimZ);
      }

      // Launch on release
      if (this.isAiming && this.input.wasJustReleased(bindings.attack)) {
        const t = Math.min(1, this.aimHoldTimeMs / AIM_RAMP_MS);
        const dist = AIM_MIN_DIST + (AIM_MAX_DIST - AIM_MIN_DIST) * t;

        const targetX = playerWorldX + Math.sin(cameraYaw) * dist;
        const targetZ = playerWorldZ + Math.cos(cameraYaw) * dist;

        const abilityType = this.selectedBomb === "water_bomb"
          ? AbilityType.WATER_BOMB
          : AbilityType.SMOKE_BOMB;
        this.sender.sendAbility(abilityType, targetX, targetZ);

        this.isAiming = false;
        this.aimHoldTimeMs = 0;
        this.aimIndicator.hide();
        this.selectedBomb = null;
      }
    } else {
      // --- Normal attack: hold = wind-up, release = swing ---
      if (this.input.wasJustPressed(bindings.attack) && this.attackCooldown <= 0 && !this.isWindingUp) {
        if (this.entity.weapon !== "torch") {
          this.isWindingUp = true;
          this.windUpCallback?.();
        }
      }

      if (this.isWindingUp && this.input.wasJustReleased(bindings.attack)) {
        this.isWindingUp = false;
        this.sender.sendAttack();
        this.attackCallback?.();
        this.attackCooldown = SWING_CONFIG.durationMs;
      }
    }

    // --- Non-bomb abilities ---
    if (this.input.wasJustPressed(bindings.caltrops)) {
      if (this.entity.role === PlayerRole.NINJA) {
        this.sender.sendAbility(AbilityType.CALTROPS);
      }
    }

    if (this.input.wasJustPressed(bindings.ability1)) {
      if (this.entity.role === PlayerRole.NINJA) {
        this.sender.sendAbility(AbilityType.GRAPPLING_HOOK);
      } else if (this.entity.role === PlayerRole.SAMURAI) {
        this.sender.sendAbility(AbilityType.TORCH_RELIGHT);
      } else if (this.entity.role === PlayerRole.SHOGUN) {
        this.sender.sendAbility(AbilityType.SHOGUN_CHARGE);
      }
    }

    if (this.input.wasJustPressed(bindings.switchWeapon)) {
      if (this.entity.role === PlayerRole.SAMURAI) {
        this.cancelWindUp();
        const cycle: Record<string, string> = { katana: "lance", lance: "torch", torch: "katana" };
        const newWeapon = cycle[this.entity.weapon] ?? "katana";
        this.sender.sendSelectWeapon(newWeapon);
      }
    }

    this.input.clearJustPressed();
  }

  cancelWindUp(): void {
    if (this.isWindingUp) {
      this.isWindingUp = false;
      this.cancelWindUpCallback?.();
    }
  }

  cancelBomb(): void {
    this.selectedBomb = null;
    this.isAiming = false;
    this.aimHoldTimeMs = 0;
    this.aimIndicator.hide();
  }

  cancelAiming(): void {
    this.isAiming = false;
    this.aimHoldTimeMs = 0;
    this.aimIndicator.hide();
  }

  getSelectedBomb(): BombKind {
    return this.selectedBomb;
  }

  getIsAiming(): boolean {
    return this.isAiming;
  }
}
