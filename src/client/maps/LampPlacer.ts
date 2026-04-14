export interface LampPlacement {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** Lamp positions are now driven by the server state (synced via onLampAdded). */
export function getLampPositions(): LampPlacement[] {
  return [];
}
