import { Schema, type } from "@colyseus/schema";

export class LampState extends Schema {
  @type("string") id: string = "";
  @type("float32") x: number = 0;
  @type("float32") z: number = 0;
  @type("float32") y: number = 3;
  @type("boolean") lit: boolean = true;
}
