import { PlayerEntity } from "./PlayerEntity.js";
import { InputManager } from "../input/InputManager.js";
import { InputSender } from "../network/InputSender.js";
import { AbilityType, PlayerRole } from "../../shared/types.js";

export class LocalPlayer {
  entity: PlayerEntity;
  private input: InputManager;
  private sender: InputSender;

  constructor(sessionId: string, role: string, input: InputManager, sender: InputSender) {
    this.entity = new PlayerEntity(sessionId, role, true);
    this.input = input;
    this.sender = sender;
  }

  update(deltaMs: number, cameraYaw: number): void {
    const moveDir = this.input.getMovementDirection();
    this.sender.update(deltaMs, moveDir, cameraYaw);

    const bindings = this.input.getBindings();

    // Attack
    if (this.input.wasJustPressed(bindings.attack)) {
      this.sender.sendAttack();
    }

    // Abilities based on role
    if (this.input.wasJustPressed(bindings.ability1)) {
      if (this.entity.role === PlayerRole.NINJA) {
        this.sender.sendAbility(AbilityType.GRAPPLING_HOOK);
      } else if (this.entity.role === PlayerRole.SAMURAI) {
        this.sender.sendAbility(AbilityType.TORCH_RELIGHT);
      } else if (this.entity.role === PlayerRole.SHOGUN) {
        this.sender.sendAbility(AbilityType.SHOGUN_CHARGE);
      }
    }

    if (this.input.wasJustPressed(bindings.ability2)) {
      if (this.entity.role === PlayerRole.NINJA) {
        // Water bomb thrown toward camera look direction, 10 units forward
        const tx = Math.sin(cameraYaw) * 10;
        const tz = Math.cos(cameraYaw) * 10;
        this.sender.sendAbility(AbilityType.WATER_BOMB, tx, tz);
      }
    }

    if (this.input.wasJustPressed(bindings.ability3)) {
      if (this.entity.role === PlayerRole.NINJA) {
        this.sender.sendAbility(AbilityType.SMOKE_BOMB);
      }
    }

    if (this.input.wasJustPressed(bindings.switchWeapon)) {
      if (this.entity.role === PlayerRole.SAMURAI) {
        const newWeapon = this.entity.weapon === "katana" ? "lance" : "katana";
        this.sender.sendSelectWeapon(newWeapon);
      }
    }

    this.input.clearJustPressed();
  }
}
