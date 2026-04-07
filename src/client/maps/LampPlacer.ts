import { LAMP_POSITIONS, LAMP } from "../../shared/constants.js";

export interface LampPlacement {
  id: string;
  x: number;
  y: number;
  z: number;
}

export function getLampPositions(): LampPlacement[] {
  return LAMP_POSITIONS.map((p) => ({
    ...p,
    y: LAMP.DEFAULT_HEIGHT,
  }));
}
