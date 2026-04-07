import { Schema, type } from "@colyseus/schema";

export class ProjectileState extends Schema {
  @type("string") id: string = "";
  @type("string") kind: string = "";
  @type("string") ownerSessionId: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") z: number = 0;
  @type("float32") targetX: number = 0;
  @type("float32") targetZ: number = 0;
  @type("boolean") active: boolean = true;

  // Server only
  startTime: number = 0;
  travelDurationMs: number = 1000;
  startX: number = 0;
  startZ: number = 0;
}
