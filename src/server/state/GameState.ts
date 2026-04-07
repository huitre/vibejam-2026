import { Schema, type, MapSchema } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { LampState } from "./LampState.js";
import { ProjectileState } from "./ProjectileState.js";

export class GameState extends Schema {
  @type("string") phase: string = "lobby";
  @type("float64") matchStartTime: number = 0;
  @type("float64") matchTimeRemaining: number = 300;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: LampState }) lamps = new MapSchema<LampState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type("string") winnerSide: string = "";
}
