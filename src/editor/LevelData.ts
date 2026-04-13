export interface PlacementEntry {
  modelName: string;
  col: number;
  row: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface LevelExport {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  placements: PlacementEntry[];
}

export function exportToJSON(
  gridWidth: number,
  gridDepth: number,
  cellSize: number,
  placements: PlacementEntry[],
): string {
  const data: LevelExport = { gridWidth, gridDepth, cellSize, placements };
  return JSON.stringify(data, null, 2);
}

export function importFromJSON(json: string): LevelExport {
  const data: LevelExport = JSON.parse(json);
  if (
    typeof data.gridWidth !== 'number' ||
    typeof data.gridDepth !== 'number' ||
    !Array.isArray(data.placements)
  ) {
    throw new Error('Invalid level JSON format');
  }
  data.cellSize = data.cellSize ?? 2;
  return data;
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
