import * as THREE from 'three';

export interface PlacedModel {
  modelName: string;
  col: number;
  row: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  mesh: THREE.Object3D;
}

export class GridSystem {
  cellSize: number;
  width: number;
  depth: number;
  private placements = new Map<string, PlacedModel>();
  private gridHelper: THREE.GridHelper | null = null;
  private groundPlane: THREE.Mesh | null = null;

  constructor(cellSize = 2, width = 40, depth = 40) {
    this.cellSize = cellSize;
    this.width = width;
    this.depth = depth;
  }

  private static key(col: number, row: number): string {
    return `${col}_${row}`;
  }

  worldToGrid(x: number, z: number): { col: number; row: number } {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(z / this.cellSize);
    return { col, row };
  }

  gridToWorld(col: number, row: number): { x: number; z: number } {
    return {
      x: col * this.cellSize + this.cellSize / 2,
      z: row * this.cellSize + this.cellSize / 2,
    };
  }

  snapToGrid(x: number, z: number): { x: number; z: number } {
    const { col, row } = this.worldToGrid(x, z);
    return this.gridToWorld(col, row);
  }

  isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.depth;
  }

  getPlacement(col: number, row: number): PlacedModel | undefined {
    return this.placements.get(GridSystem.key(col, row));
  }

  place(model: PlacedModel): void {
    this.placements.set(GridSystem.key(model.col, model.row), model);
  }

  remove(col: number, row: number): PlacedModel | undefined {
    const key = GridSystem.key(col, row);
    const model = this.placements.get(key);
    if (model) this.placements.delete(key);
    return model;
  }

  clearAll(): PlacedModel[] {
    const all = Array.from(this.placements.values());
    this.placements.clear();
    return all;
  }

  getAllPlacements(): PlacedModel[] {
    return Array.from(this.placements.values());
  }

  get placementCount(): number {
    return this.placements.size;
  }

  createVisuals(scene: THREE.Scene): void {
    this.removeVisuals(scene);

    const totalX = this.width * this.cellSize;
    const totalZ = this.depth * this.cellSize;
    const maxDim = Math.max(totalX, totalZ);

    this.gridHelper = new THREE.GridHelper(
      maxDim,
      Math.max(this.width, this.depth),
      0x0f3460,
      0x16213e,
    );
    this.gridHelper.position.set(totalX / 2, 0, totalZ / 2);
    scene.add(this.gridHelper);

    const groundGeo = new THREE.PlaneGeometry(totalX, totalZ);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
    });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.set(totalX / 2, -0.01, totalZ / 2);
    this.groundPlane.name = '__ground__';
    scene.add(this.groundPlane);
  }

  removeVisuals(scene: THREE.Scene): void {
    if (this.gridHelper) {
      scene.remove(this.gridHelper);
      this.gridHelper = null;
    }
    if (this.groundPlane) {
      scene.remove(this.groundPlane);
      this.groundPlane = null;
    }
  }

  getGroundPlane(): THREE.Mesh | null {
    return this.groundPlane;
  }
}
