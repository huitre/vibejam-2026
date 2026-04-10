import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") role: string = "";
  @type("string") weapon: string = "katana";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") z: number = 0;
  @type("float32") rotationY: number = 0;
  @type("int16") hp: number = 100;
  @type("int16") maxHp: number = 100;
  @type("boolean") alive: boolean = true;
  @type("boolean") isAttacking: boolean = false;
  @type("boolean") isStunned: boolean = false;
  @type("boolean") isInSmoke: boolean = false;
  @type("boolean") isClimbing: boolean = false;
  @type("int32") lastAttackTime: number = 0;
  @type("int16") torchesLeft: number = 0;

  // Server-only (not synced)
  waterBombsLeft: number = 0;
  smokeBombsLeft: number = 0;
  hasGrapplingHook: boolean = false;
  chargeCooldownUntil: number = 0;
  stunUntil: number = 0;
  channelingLampId: string | null = null;
  channelingStartTime: number = 0;
}
