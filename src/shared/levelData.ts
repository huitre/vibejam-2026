export interface LevelCollider {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  height: number;
}

export interface LevelPlacement {
  modelName: string;
  x: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale?: number;
}

export interface LevelRamp {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  startHeight: number;
  endHeight: number;
  direction: 'x' | 'z';
  ascending: boolean;
  rotationY: number;
}

export interface LevelSpawn {
  x: number;
  z: number;
}

export interface LevelData {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  placements: LevelPlacement[];
  colliders: LevelCollider[];
  ramps: LevelRamp[];
  spawns: Record<string, LevelSpawn[]>;
}

export function parseLevelJSON(json: string): LevelData {
  const data = JSON.parse(json);
  if (
    typeof data.gridWidth !== "number" ||
    typeof data.gridDepth !== "number" ||
    !Array.isArray(data.placements)
  ) {
    throw new Error("Invalid level JSON format");
  }

  // Normalize spawns: old format (single object per role) → array of 1
  const rawSpawns = data.spawns ?? {};
  const spawns: Record<string, LevelSpawn[]> = {};
  for (const [role, val] of Object.entries(rawSpawns)) {
    if (Array.isArray(val)) {
      spawns[role] = val as LevelSpawn[];
    } else {
      spawns[role] = [val as LevelSpawn];
    }
  }

  return {
    gridWidth: data.gridWidth,
    gridDepth: data.gridDepth,
    cellSize: data.cellSize ?? 1,
    placements: data.placements,
    colliders: (data.colliders ?? []).map((c: any) => ({
      minX: c.minX,
      minZ: c.minZ,
      maxX: c.maxX,
      maxZ: c.maxZ,
      height: c.height ?? 3,
    })),
    ramps: (data.ramps ?? []).map((r: any) => ({
      minX: r.minX,
      minZ: r.minZ,
      maxX: r.maxX,
      maxZ: r.maxZ,
      startHeight: r.startHeight ?? 0,
      endHeight: r.endHeight ?? 3,
      direction: r.direction === 'x' ? 'x' : 'z',
      ascending: r.ascending ?? true,
      rotationY: r.rotationY ?? 0,
    })),
    spawns,
  };
}
