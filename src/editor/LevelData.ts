export interface PlacementEntry {
  modelName: string;
  x: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale?: number;
}

export interface ColliderEntry {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  height: number;
}

export interface RampEntry {
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

export interface SpawnEntry {
  x: number;
  z: number;
}

export interface LevelExport {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  placements: PlacementEntry[];
  colliders: ColliderEntry[];
  ramps: RampEntry[];
  spawns: Record<string, SpawnEntry[]>;
}

export function exportToJSON(
  gridWidth: number,
  gridDepth: number,
  cellSize: number,
  placements: PlacementEntry[],
  colliders: ColliderEntry[],
  spawns: Record<string, SpawnEntry[]> = {},
  ramps: RampEntry[] = [],
): string {
  const data: LevelExport = { gridWidth, gridDepth, cellSize, placements, colliders, ramps, spawns };
  return JSON.stringify(data, null, 2);
}

export function importFromJSON(json: string): LevelExport {
  const data = JSON.parse(json);
  if (
    typeof data.gridWidth !== 'number' ||
    typeof data.gridDepth !== 'number' ||
    !Array.isArray(data.placements)
  ) {
    throw new Error('Invalid level JSON format');
  }
  data.cellSize = data.cellSize ?? 1;
  data.colliders = data.colliders ?? [];
  data.ramps = data.ramps ?? [];

  // Normalize spawns: old format (single object per role) → array of 1
  const rawSpawns = data.spawns ?? {};
  const spawns: Record<string, SpawnEntry[]> = {};
  for (const [role, val] of Object.entries(rawSpawns)) {
    if (Array.isArray(val)) {
      spawns[role] = val as SpawnEntry[];
    } else {
      spawns[role] = [val as SpawnEntry];
    }
  }
  data.spawns = spawns;

  return data as LevelExport;
}

export function downloadJSON(content: string, filename = 'level.json') {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
