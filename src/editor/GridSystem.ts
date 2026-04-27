import * as THREE from 'three';

export interface PlacedModel {
  id: number;
  modelName: string;
  x: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  mesh: THREE.Object3D;
}

export interface CollisionBox {
  id: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  height: number;
  mesh: THREE.Mesh;
}

export interface RampBox {
  id: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  startHeight: number;
  endHeight: number;
  direction: 'x' | 'z';
  ascending: boolean;
  rotationY: number;
  mesh: THREE.Mesh;
}

export interface SpawnMarker {
  role: string;
  x: number;
  z: number;
  mesh: THREE.Mesh;
}

const SPAWN_COLORS: Record<string, number> = {
  ninja: 0x9b59b6,
  samurai: 0x3498db,
  shogun: 0xf1c40f,
};

export class GridSystem {
  cellSize: number;
  width: number;
  depth: number;
  private placements = new Map<number, PlacedModel>();
  private nextId = 1;
  private gridHelper: THREE.GridHelper | null = null;
  private groundPlane: THREE.Mesh | null = null;

  private colliders = new Map<number, CollisionBox>();
  private nextColliderId = 1;

  private ramps = new Map<number, RampBox>();
  private nextRampId = 1;

  private spawns = new Map<string, SpawnMarker[]>();

  constructor(cellSize = 1, width = 80, depth = 80) {
    this.cellSize = cellSize;
    this.width = width;
    this.depth = depth;
  }

  /** Snap a world coordinate to the nearest grid intersection */
  snapToGrid(x: number, z: number): { x: number; z: number } {
    return {
      x: Math.round(x / this.cellSize) * this.cellSize,
      z: Math.round(z / this.cellSize) * this.cellSize,
    };
  }

  isInBounds(x: number, z: number): boolean {
    const totalX = this.width * this.cellSize;
    const totalZ = this.depth * this.cellSize;
    return x >= 0 && x <= totalX && z >= 0 && z <= totalZ;
  }

  place(model: Omit<PlacedModel, 'id'>): PlacedModel {
    const id = this.nextId++;
    const placed: PlacedModel = { id, ...model };
    this.placements.set(id, placed);
    return placed;
  }

  removeById(id: number): PlacedModel | undefined {
    const model = this.placements.get(id);
    if (model) this.placements.delete(id);
    return model;
  }

  /** Find placement whose mesh (or ancestor) matches the given object */
  findByMesh(object: THREE.Object3D): PlacedModel | undefined {
    for (const p of this.placements.values()) {
      if (this.isDescendant(object, p.mesh)) return p;
    }
    return undefined;
  }

  private isDescendant(child: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = child;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
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

  /** Get all placed meshes for raycasting */
  getPlacedMeshes(): THREE.Object3D[] {
    return this.getAllPlacements().map((p) => p.mesh);
  }

  /** Return the max height of placed models overlapping a 2D area, or null if none found */
  getHeightOfModelsInArea(minX: number, minZ: number, maxX: number, maxZ: number): number | null {
    let maxHeight: number | null = null;
    for (const p of this.placements.values()) {
      const box = new THREE.Box3().setFromObject(p.mesh);
      // Check 2D overlap (XZ)
      if (box.max.x > minX && box.min.x < maxX && box.max.z > minZ && box.min.z < maxZ) {
        const h = box.max.y - box.min.y;
        if (maxHeight === null || h > maxHeight) maxHeight = h;
      }
    }
    return maxHeight;
  }

  // ── Collider methods ──────────────────────────────────────────────────

  addCollider(minX: number, minZ: number, maxX: number, maxZ: number, height = 3): CollisionBox {
    const id = this.nextColliderId++;
    const w = maxX - minX;
    const d = maxZ - minZ;

    const geo = new THREE.BoxGeometry(w, height, d);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(minX + w / 2, height / 2, minZ + d / 2);
    mesh.name = '__collider__';

    const box: CollisionBox = { id, minX, minZ, maxX, maxZ, height, mesh };
    this.colliders.set(id, box);
    return box;
  }

  removeColliderById(id: number): CollisionBox | undefined {
    const box = this.colliders.get(id);
    if (box) this.colliders.delete(id);
    return box;
  }

  findColliderByMesh(object: THREE.Object3D): CollisionBox | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      for (const c of this.colliders.values()) {
        if (c.mesh === current) return c;
      }
      current = current.parent;
    }
    return undefined;
  }

  getAllColliders(): CollisionBox[] {
    return Array.from(this.colliders.values());
  }

  getColliderMeshes(): THREE.Object3D[] {
    return this.getAllColliders().map((c) => c.mesh);
  }

  clearColliders(): CollisionBox[] {
    const all = Array.from(this.colliders.values());
    this.colliders.clear();
    return all;
  }

  get colliderCount(): number {
    return this.colliders.size;
  }

  // ── Ramp methods ────────────────────────────────────────────────────────

  addRamp(
    minX: number, minZ: number, maxX: number, maxZ: number,
    startHeight: number, endHeight: number,
    direction: 'x' | 'z', ascending: boolean,
    rotationY = 0,
  ): RampBox {
    const id = this.nextRampId++;
    const w = maxX - minX;
    const d = maxZ - minZ;
    const hLow = Math.min(startHeight, endHeight);
    const hHigh = Math.max(startHeight, endHeight);
    const hMid = (hLow + hHigh) / 2;

    // Create an inclined plane using a BoxGeometry with minimal thickness
    const thickness = 0.15;
    const length = direction === 'x' ? w : d;
    const breadth = direction === 'x' ? d : w;
    const geo = new THREE.BoxGeometry(
      direction === 'x' ? length : breadth,
      thickness,
      direction === 'x' ? breadth : length,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(minX + w / 2, hMid, minZ + d / 2);

    // Tilt the mesh to visualize the slope
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = rotationY;
    const angle = Math.atan2(hHigh - hLow, length);
    const sign = ascending ? 1 : -1;
    if (direction === 'z') {
      mesh.rotation.x = -sign * angle;
    } else {
      mesh.rotation.z = sign * angle;
    }
    mesh.name = '__ramp__';

    const ramp: RampBox = { id, minX, minZ, maxX, maxZ, startHeight, endHeight, direction, ascending, rotationY, mesh };
    this.ramps.set(id, ramp);
    return ramp;
  }

  removeRampById(id: number): RampBox | undefined {
    const ramp = this.ramps.get(id);
    if (ramp) this.ramps.delete(id);
    return ramp;
  }

  findRampByMesh(object: THREE.Object3D): RampBox | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      for (const r of this.ramps.values()) {
        if (r.mesh === current) return r;
      }
      current = current.parent;
    }
    return undefined;
  }

  getAllRamps(): RampBox[] {
    return Array.from(this.ramps.values());
  }

  getRampMeshes(): THREE.Object3D[] {
    return this.getAllRamps().map((r) => r.mesh);
  }

  clearRamps(): RampBox[] {
    const all = Array.from(this.ramps.values());
    this.ramps.clear();
    return all;
  }

  get rampCount(): number {
    return this.ramps.size;
  }

  // ── Spawn methods ───────────────────────────────────────────────────────

  setSpawn(role: string, x: number, z: number): SpawnMarker {
    const color = SPAWN_COLORS[role] ?? 0xffffff;
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 2, 12);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1, z);
    mesh.name = '__spawn__';

    const marker: SpawnMarker = { role, x, z, mesh };

    // Samurai: append (multiple spawns allowed)
    // Other roles: replace (single spawn)
    if (role === 'samurai') {
      const arr = this.spawns.get(role) ?? [];
      arr.push(marker);
      this.spawns.set(role, arr);
    } else {
      const existing = this.spawns.get(role);
      if (existing) {
        for (const m of existing) m.mesh.parent?.remove(m.mesh);
      }
      this.spawns.set(role, [marker]);
    }

    return marker;
  }

  removeSpawn(role: string): SpawnMarker | undefined {
    const arr = this.spawns.get(role);
    if (!arr || arr.length === 0) return undefined;
    const marker = arr[arr.length - 1];
    marker.mesh.parent?.remove(marker.mesh);
    arr.pop();
    if (arr.length === 0) this.spawns.delete(role);
    return marker;
  }

  removeSpawnByMesh(object: THREE.Object3D): SpawnMarker | undefined {
    for (const [role, arr] of this.spawns) {
      const idx = arr.findIndex((m) => m.mesh === object);
      if (idx !== -1) {
        const marker = arr[idx];
        marker.mesh.parent?.remove(marker.mesh);
        arr.splice(idx, 1);
        if (arr.length === 0) this.spawns.delete(role);
        return marker;
      }
    }
    return undefined;
  }

  getSpawn(role: string): SpawnMarker | undefined {
    const arr = this.spawns.get(role);
    return arr ? arr[0] : undefined;
  }

  getAllSpawns(): Record<string, { x: number; z: number }[]> {
    const result: Record<string, { x: number; z: number }[]> = {};
    for (const [role, arr] of this.spawns) {
      result[role] = arr.map((m) => ({ x: m.x, z: m.z }));
    }
    return result;
  }

  clearSpawns(): SpawnMarker[] {
    const all: SpawnMarker[] = [];
    for (const arr of this.spawns.values()) {
      all.push(...arr);
    }
    this.spawns.clear();
    return all;
  }

  getSpawnMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const arr of this.spawns.values()) {
      for (const s of arr) meshes.push(s.mesh);
    }
    return meshes;
  }

  findSpawnByMesh(object: THREE.Object3D): SpawnMarker | undefined {
    for (const arr of this.spawns.values()) {
      for (const marker of arr) {
        if (marker.mesh === object) return marker;
      }
    }
    return undefined;
  }

  // ── Placement update ────────────────────────────────────────────────

  updatePlacement(id: number, x: number, z: number): void {
    const placed = this.placements.get(id);
    if (!placed) return;
    placed.x = x;
    placed.z = z;
    placed.mesh.position.x = x;
    placed.mesh.position.z = z;
  }

  updatePlacementScale(id: number, scale: number): void {
    const placed = this.placements.get(id);
    if (!placed) return;
    placed.scale = scale;
    placed.mesh.scale.set(scale, scale, scale);
  }

  // ── Visuals ───────────────────────────────────────────────────────────

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
