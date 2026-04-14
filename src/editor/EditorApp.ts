import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GridSystem } from './GridSystem';
import { ModelCatalog } from './ModelCatalog';
import { EditorUI } from './EditorUI';
import { exportToJSON, importFromJSON, downloadJSON } from './LevelData';
import type { PlacementEntry, ColliderEntry, RampEntry, SpawnEntry } from './LevelData';

/** Models that automatically generate collision boxes on export */
/** Models that automatically generate collision boxes on export */
const COLLIDABLE_MODELS = new Set([
  'wall_l', 'wall_m', 'wall_corner_l', 'wall_corner_m',
  'castle_wall', 'castle_wall_corner',
  'corner_tower', 'tower',
]);

export class EditorApp {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private grid: GridSystem;
  private catalog: ModelCatalog;
  private ui!: EditorUI;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private activeModel: string | null = null;
  private ghostMesh: THREE.Group | null = null;
  private ghostRotationX = 0;
  private ghostRotationY = 0;
  private ghostRotationZ = 0;

  // Collision mode state
  private collisionMode = false;
  private collisionCorner1: { x: number; z: number } | null = null;
  private collisionPreview: THREE.Mesh | null = null;

  // Ramp mode state
  private rampMode = false;
  private rampCorner1: { x: number; z: number } | null = null;
  private rampPreview: THREE.Mesh | null = null;
  private rampRotationY = 0;

  // Spawn mode state
  private static readonly SPAWN_ROLES = ['ninja', 'samurai', 'shogun'] as const;
  private static readonly SPAWN_COLORS: Record<string, number> = {
    ninja: 0x9b59b6,
    samurai: 0x3498db,
    shogun: 0xf1c40f,
  };
  private spawnMode = false;
  private spawnRole = 'ninja';
  private spawnGhost: THREE.Mesh | null = null;

  constructor() {
    this.grid = new GridSystem(0.5, 160, 160);
    this.catalog = new ModelCatalog();
  }

  async init(): Promise<void> {
    this.initThree();
    this.initLights();
    this.grid.createVisuals(this.scene);
    this.initUI();
    this.initEvents();
    this.animate();
    await this.loadDefaultLevel();
  }

  private async loadDefaultLevel(): Promise<void> {
    try {
      const res = await fetch('/map_pieces/level_1.json');
      if (!res.ok) return;
      const json = await res.text();
      await this.importLevel(json);
    } catch {
      // No default level found, start empty
    }
  }

  private initThree(): void {
    const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    this.camera = new THREE.PerspectiveCamera(
      50,
      (window.innerWidth - 280) / window.innerHeight,
      0.1,
      500,
    );
    this.camera.position.set(40, 60, -20);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth - 280, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, canvas);
    const totalX = this.grid.width * this.grid.cellSize;
    const totalZ = this.grid.depth * this.grid.cellSize;
    this.controls.target.set(totalX / 2, 0, totalZ / 2);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.update();

    window.addEventListener('resize', () => {
      const w = window.innerWidth - 280;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  private initLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(30, 50, 20);
    dir.castShadow = false;
    this.scene.add(ambient, dir);
  }

  private initUI(): void {
    this.ui = new EditorUI(this.catalog, {
      onSelectModel: (name) => this.setActiveModel(name),
      onExport: () => this.exportLevel(),
      onImport: (json) => this.importLevel(json),
      onClearAll: () => this.clearAll(),
      onGridResize: (w, d) => this.resizeGrid(w, d),
      onToggleCollisionMode: () => this.toggleCollisionMode(),
      onToggleSpawnMode: () => this.toggleSpawnMode(),
      onToggleRampMode: () => this.toggleRampMode(),
    });
    this.updateInfo();
  }

  private initEvents(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('click', (e) => this.onLeftClick(e));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onRightClick(e);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'x' || e.key === 'X') this.rotateGhost('x');
      if (e.key === 'y' || e.key === 'Y') {
        if (this.rampMode) {
          this.rampRotationY += Math.PI / 2;
          if (this.rampPreview) this.rampPreview.rotation.y = this.rampRotationY;
        } else {
          this.rotateGhost('y');
        }
      }
      if (e.key === 'z' || e.key === 'Z') this.rotateGhost('z');
      if (e.key === 'c' || e.key === 'C') this.toggleCollisionMode();
      if (e.key === 's' || e.key === 'S') this.toggleSpawnMode();
      if (e.key === 'r' || e.key === 'R') this.toggleRampMode();
      if (this.spawnMode) {
        if (e.key === '1') this.setSpawnRole('ninja');
        if (e.key === '2') this.setSpawnRole('samurai');
        if (e.key === '3') this.setSpawnRole('shogun');
      }
      if (e.key === 'Escape') {
        if (this.rampMode) {
          this.cancelRampDraw();
        } else if (this.spawnMode) {
          this.toggleSpawnMode();
        } else if (this.collisionMode) {
          this.cancelCollisionDraw();
        } else {
          this.deselect();
        }
      }
    });
  }

  // ── Collision mode ──────────────────────────────────────────────────────

  private toggleCollisionMode(): void {
    this.collisionMode = !this.collisionMode;
    this.ui.setCollisionModeActive(this.collisionMode);

    if (this.collisionMode) {
      // Exit spawn mode if active
      if (this.spawnMode) {
        this.spawnMode = false;
        this.ui.setSpawnModeActive(false);
        this.removeSpawnGhost();
      }
      // Hide ghost, deselect model
      this.removeGhost();
      this.activeModel = null;
      this.ui.clearSelection();
    }

    this.cancelCollisionDraw();
    this.updateInfo();
  }

  private cancelCollisionDraw(): void {
    this.collisionCorner1 = null;
    this.removeCollisionPreview();
  }

  private removeCollisionPreview(): void {
    if (this.collisionPreview) {
      this.scene.remove(this.collisionPreview);
      this.collisionPreview = null;
    }
  }

  private updateCollisionPreview(currentX: number, currentZ: number): void {
    if (!this.collisionCorner1) return;

    this.removeCollisionPreview();

    const c1 = this.collisionCorner1;
    const minX = Math.min(c1.x, currentX);
    const maxX = Math.max(c1.x, currentX);
    const minZ = Math.min(c1.z, currentZ);
    const maxZ = Math.max(c1.z, currentZ);
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w < 0.01 && d < 0.01) return;

    const h = 3;
    const geo = new THREE.BoxGeometry(w || 0.1, h, d || 0.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    this.collisionPreview = new THREE.Mesh(geo, mat);
    this.collisionPreview.position.set(minX + w / 2, h / 2, minZ + d / 2);
    this.scene.add(this.collisionPreview);
  }

  private raycastColliders(): THREE.Object3D | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.grid.getColliderMeshes();
    const hits = this.raycaster.intersectObjects(meshes, true);
    return hits.length > 0 ? hits[0].object : null;
  }

  // ── Ramp mode ─────────────────────────────────────────────────────────

  private toggleRampMode(): void {
    this.rampMode = !this.rampMode;
    this.ui.setRampModeActive(this.rampMode);

    if (this.rampMode) {
      if (this.collisionMode) {
        this.collisionMode = false;
        this.ui.setCollisionModeActive(false);
        this.cancelCollisionDraw();
      }
      if (this.spawnMode) {
        this.spawnMode = false;
        this.ui.setSpawnModeActive(false);
        this.removeSpawnGhost();
      }
      this.removeGhost();
      this.activeModel = null;
      this.ui.clearSelection();
    }

    this.cancelRampDraw();
    this.updateInfo();
  }

  private cancelRampDraw(): void {
    this.rampCorner1 = null;
    this.rampRotationY = 0;
    this.removeRampPreview();
  }

  private removeRampPreview(): void {
    if (this.rampPreview) {
      this.scene.remove(this.rampPreview);
      this.rampPreview = null;
    }
  }

  private updateRampPreview(currentX: number, currentZ: number): void {
    if (!this.rampCorner1) return;

    this.removeRampPreview();

    const c1 = this.rampCorner1;
    const minX = Math.min(c1.x, currentX);
    const maxX = Math.max(c1.x, currentX);
    const minZ = Math.min(c1.z, currentZ);
    const maxZ = Math.max(c1.z, currentZ);
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w < 0.01 && d < 0.01) return;

    const h = 0.15;
    const geo = new THREE.BoxGeometry(w || 0.1, h, d || 0.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.rampPreview = new THREE.Mesh(geo, mat);
    this.rampPreview.position.set(minX + w / 2, h / 2, minZ + d / 2);
    this.rampPreview.rotation.y = this.rampRotationY;
    this.scene.add(this.rampPreview);
  }

  private raycastRamps(): THREE.Object3D | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.grid.getRampMeshes();
    const hits = this.raycaster.intersectObjects(meshes, true);
    return hits.length > 0 ? hits[0].object : null;
  }

  // ── Spawn mode ────────────────────────────────────────────────────────

  private toggleSpawnMode(): void {
    this.spawnMode = !this.spawnMode;
    this.ui.setSpawnModeActive(this.spawnMode);

    if (this.spawnMode) {
      // Exit collision mode if active
      if (this.collisionMode) {
        this.collisionMode = false;
        this.ui.setCollisionModeActive(false);
        this.cancelCollisionDraw();
      }
      this.removeGhost();
      this.activeModel = null;
      this.ui.clearSelection();
    } else {
      this.removeSpawnGhost();
    }

    this.updateInfo();
  }

  private setSpawnRole(role: string): void {
    this.spawnRole = role;
    this.removeSpawnGhost();
    this.updateInfo();
  }

  private createSpawnGhost(): void {
    this.removeSpawnGhost();
    const color = EditorApp.SPAWN_COLORS[this.spawnRole] ?? 0xffffff;
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 2, 12);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
    this.spawnGhost = new THREE.Mesh(geo, mat);
    this.spawnGhost.position.y = 1;
    this.scene.add(this.spawnGhost);
  }

  private removeSpawnGhost(): void {
    if (this.spawnGhost) {
      this.scene.remove(this.spawnGhost);
      this.spawnGhost = null;
    }
  }

  // ── Mouse / click handlers ──────────────────────────────────────────────

  private updateMouseFromEvent(e: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastGround(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ground = this.grid.getGroundPlane();
    if (!ground) return null;
    const hits = this.raycaster.intersectObject(ground);
    return hits.length > 0 ? hits[0].point : null;
  }

  /** Raycast against all placed models to find which one the user clicked */
  private raycastPlacedModels(): THREE.Object3D | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.grid.getPlacedMeshes();
    const hits = this.raycaster.intersectObjects(meshes, true);
    return hits.length > 0 ? hits[0].object : null;
  }

  private async onMouseMove(e: MouseEvent): Promise<void> {
    this.updateMouseFromEvent(e);

    if (this.spawnMode) {
      const point = this.raycastGround();
      if (!point) return;
      const snapped = this.grid.snapToGrid(point.x, point.z);
      if (!this.grid.isInBounds(snapped.x, snapped.z)) {
        this.removeSpawnGhost();
        return;
      }
      if (!this.spawnGhost) this.createSpawnGhost();
      if (this.spawnGhost) this.spawnGhost.position.set(snapped.x, 1, snapped.z);
      return;
    }

    if (this.rampMode) {
      const point = this.raycastGround();
      if (point && this.rampCorner1) {
        const snapped = this.grid.snapToGrid(point.x, point.z);
        this.updateRampPreview(snapped.x, snapped.z);
      }
      return;
    }

    if (this.collisionMode) {
      const point = this.raycastGround();
      if (point && this.collisionCorner1) {
        const snapped = this.grid.snapToGrid(point.x, point.z);
        this.updateCollisionPreview(snapped.x, snapped.z);
      }
      return;
    }

    if (!this.activeModel) return;

    const point = this.raycastGround();
    if (!point) return;

    const snapped = this.grid.snapToGrid(point.x, point.z);
    if (!this.grid.isInBounds(snapped.x, snapped.z)) {
      this.removeGhost();
      return;
    }

    if (!this.ghostMesh) {
      await this.createGhost();
    }

    if (this.ghostMesh) {
      this.ghostMesh.position.set(snapped.x, 0, snapped.z);
      this.applyGhostRotation();
    }
  }

  private async createGhost(): Promise<void> {
    if (!this.activeModel) return;
    this.removeGhost();
    const model = await this.catalog.loadModel(this.activeModel);
    this.ghostMesh = this.catalog.createGhost(model);
    this.applyGhostRotation();
    this.scene.add(this.ghostMesh);
  }

  private applyGhostRotation(): void {
    if (!this.ghostMesh) return;
    this.ghostMesh.rotation.set(this.ghostRotationX, this.ghostRotationY, this.ghostRotationZ);
  }

  private removeGhost(): void {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
  }

  private async onLeftClick(e: MouseEvent): Promise<void> {
    this.updateMouseFromEvent(e);

    if (this.spawnMode) {
      const point = this.raycastGround();
      if (!point) return;
      const snapped = this.grid.snapToGrid(point.x, point.z);
      if (!this.grid.isInBounds(snapped.x, snapped.z)) return;
      const marker = this.grid.setSpawn(this.spawnRole, snapped.x, snapped.z);
      this.scene.add(marker.mesh);
      this.updateInfo();
      return;
    }

    if (this.rampMode) {
      const point = this.raycastGround();
      if (!point) return;
      const snapped = this.grid.snapToGrid(point.x, point.z);

      if (!this.rampCorner1) {
        this.rampCorner1 = { x: snapped.x, z: snapped.z };
      } else {
        const c1 = this.rampCorner1;
        const minX = Math.min(c1.x, snapped.x);
        const maxX = Math.max(c1.x, snapped.x);
        const minZ = Math.min(c1.z, snapped.z);
        const maxZ = Math.max(c1.z, snapped.z);

        if (maxX - minX > 0.01 || maxZ - minZ > 0.01) {
          const endHeightStr = prompt('End height for ramp (start=0):', '3');
          const endHeight = parseFloat(endHeightStr ?? '3') || 3;
          const direction: 'x' | 'z' = (maxX - minX) >= (maxZ - minZ) ? 'x' : 'z';
          const ramp = this.grid.addRamp(minX, minZ, maxX, maxZ, 0, endHeight, direction, true, this.rampRotationY);
          this.scene.add(ramp.mesh);
        }

        this.rampCorner1 = null;
        this.removeRampPreview();
        this.updateInfo();
      }
      return;
    }

    if (this.collisionMode) {
      const point = this.raycastGround();
      if (!point) return;
      const snapped = this.grid.snapToGrid(point.x, point.z);

      if (!this.collisionCorner1) {
        // First click: set corner1
        this.collisionCorner1 = { x: snapped.x, z: snapped.z };
      } else {
        // Second click: create collider
        const c1 = this.collisionCorner1;
        const minX = Math.min(c1.x, snapped.x);
        const maxX = Math.max(c1.x, snapped.x);
        const minZ = Math.min(c1.z, snapped.z);
        const maxZ = Math.max(c1.z, snapped.z);

        if (maxX - minX > 0.01 || maxZ - minZ > 0.01) {
          const modelHeight = this.grid.getHeightOfModelsInArea(minX, minZ, maxX, maxZ);
          const box = this.grid.addCollider(minX, minZ, maxX, maxZ, modelHeight ?? 3);
          this.scene.add(box.mesh);
        }

        this.collisionCorner1 = null;
        this.removeCollisionPreview();
        this.updateInfo();
      }
      return;
    }

    if (!this.activeModel) return;

    const point = this.raycastGround();
    if (!point) return;

    const snapped = this.grid.snapToGrid(point.x, point.z);
    if (!this.grid.isInBounds(snapped.x, snapped.z)) return;

    await this.placeModel(
      this.activeModel, snapped.x, snapped.z,
      this.ghostRotationX, this.ghostRotationY, this.ghostRotationZ,
    );
  }

  private onRightClick(e: MouseEvent): void {
    this.updateMouseFromEvent(e);

    if (this.spawnMode) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = this.grid.getSpawnMeshes();
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length === 0) return;
      const marker = this.grid.findSpawnByMesh(hits[0].object);
      if (marker) {
        this.grid.removeSpawn(marker.role);
        this.updateInfo();
      }
      return;
    }

    if (this.rampMode) {
      const hit = this.raycastRamps();
      if (!hit) return;
      const ramp = this.grid.findRampByMesh(hit);
      if (ramp) {
        this.grid.removeRampById(ramp.id);
        this.scene.remove(ramp.mesh);
        this.updateInfo();
      }
      return;
    }

    if (this.collisionMode) {
      // Delete collider under cursor
      const hit = this.raycastColliders();
      if (!hit) return;
      const collider = this.grid.findColliderByMesh(hit);
      if (collider) {
        this.grid.removeColliderById(collider.id);
        this.scene.remove(collider.mesh);
        this.updateInfo();
      }
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Raycast against placed models
    const hit = this.raycastPlacedModels();
    if (!hit) return;

    const placed = this.grid.findByMesh(hit);
    if (placed) {
      this.grid.removeById(placed.id);
      this.scene.remove(placed.mesh);
      this.updateInfo();
    }
  }

  private async setActiveModel(name: string): Promise<void> {
    // Exiting collision mode when selecting a model
    if (this.collisionMode) {
      this.collisionMode = false;
      this.ui.setCollisionModeActive(false);
      this.cancelCollisionDraw();
    }
    // Exiting spawn mode when selecting a model
    if (this.spawnMode) {
      this.spawnMode = false;
      this.ui.setSpawnModeActive(false);
      this.removeSpawnGhost();
    }
    // Exiting ramp mode when selecting a model
    if (this.rampMode) {
      this.rampMode = false;
      this.ui.setRampModeActive(false);
      this.cancelRampDraw();
    }

    this.activeModel = name;
    this.ghostRotationX = 0;
    this.ghostRotationY = 0;
    this.ghostRotationZ = 0;
    this.removeGhost();
    this.updateInfo();
  }

  private rotateGhost(axis: 'x' | 'y' | 'z'): void {
    const step = Math.PI / 2;
    if (axis === 'x') this.ghostRotationX += step;
    else if (axis === 'y') this.ghostRotationY += step;
    else this.ghostRotationZ += step;
    this.applyGhostRotation();
    this.updateInfo();
  }

  private deselect(): void {
    this.activeModel = null;
    this.removeGhost();
    this.ui.clearSelection();
    this.updateInfo();
  }

  async placeModel(
    modelName: string, x: number, z: number,
    rotationX: number, rotationY: number, rotationZ: number,
  ): Promise<void> {
    const model = await this.catalog.loadModel(modelName);
    model.position.set(x, 0, z);
    model.rotation.set(rotationX, rotationY, rotationZ);
    this.scene.add(model);

    this.grid.place({ modelName, x, z, rotationX, rotationY, rotationZ, mesh: model });
    this.updateInfo();
  }

  exportLevel(): void {
    const placements: PlacementEntry[] = this.grid.getAllPlacements().map((p) => ({
      modelName: p.modelName,
      x: p.x,
      z: p.z,
      rotationX: p.rotationX,
      rotationY: p.rotationY,
      rotationZ: p.rotationZ,
    }));

    // Manual colliders
    const colliders: ColliderEntry[] = this.grid.getAllColliders().map((c) => ({
      minX: c.minX,
      minZ: c.minZ,
      maxX: c.maxX,
      maxZ: c.maxZ,
      height: c.height,
    }));

    // Auto-generate colliders from collidable models
    for (const p of this.grid.getAllPlacements()) {
      if (!COLLIDABLE_MODELS.has(p.modelName)) continue;
      const box = new THREE.Box3().setFromObject(p.mesh);
      colliders.push({
        minX: box.min.x,
        minZ: box.min.z,
        maxX: box.max.x,
        maxZ: box.max.z,
        height: box.max.y - box.min.y,
      });
    }

    const ramps: RampEntry[] = this.grid.getAllRamps().map((r) => ({
      minX: r.minX,
      minZ: r.minZ,
      maxX: r.maxX,
      maxZ: r.maxZ,
      startHeight: r.startHeight,
      endHeight: r.endHeight,
      direction: r.direction,
      ascending: r.ascending,
      rotationY: r.rotationY,
    }));

    const spawns = this.grid.getAllSpawns();
    const json = exportToJSON(this.grid.width, this.grid.depth, this.grid.cellSize, placements, colliders, spawns, ramps);
    downloadJSON(json);
  }

  async importLevel(jsonStr: string): Promise<void> {
    try {
      const data = importFromJSON(jsonStr);
      this.clearAll();

      // Keep editor cell size for finer grid; convert width/depth to match spatial extent
      const jsonCellSize = data.cellSize || 1;
      const editorCellSize = this.grid.cellSize;
      this.grid.width = Math.round(data.gridWidth * jsonCellSize / editorCellSize);
      this.grid.depth = Math.round(data.gridDepth * jsonCellSize / editorCellSize);
      this.grid.createVisuals(this.scene);
      this.updateOrbitTarget();

      for (const p of data.placements) {
        await this.placeModel(
          p.modelName, p.x, p.z,
          p.rotationX ?? 0, p.rotationY ?? 0, p.rotationZ ?? 0,
        );
      }

      // Import colliders
      for (const c of data.colliders) {
        const box = this.grid.addCollider(c.minX, c.minZ, c.maxX, c.maxZ, c.height ?? 3);
        this.scene.add(box.mesh);
      }

      // Import ramps
      for (const r of data.ramps) {
        const ramp = this.grid.addRamp(
          r.minX, r.minZ, r.maxX, r.maxZ,
          r.startHeight, r.endHeight, r.direction, r.ascending,
          r.rotationY ?? 0,
        );
        this.scene.add(ramp.mesh);
      }

      // Import spawns
      for (const [role, pos] of Object.entries(data.spawns)) {
        const marker = this.grid.setSpawn(role, pos.x, pos.z);
        this.scene.add(marker.mesh);
      }

      (document.getElementById('grid-width') as HTMLInputElement).value = String(this.grid.width);
      (document.getElementById('grid-depth') as HTMLInputElement).value = String(this.grid.depth);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import level: ' + (err as Error).message);
    }
  }

  private clearAll(): void {
    const allPlacements = this.grid.clearAll();
    for (const p of allPlacements) {
      this.scene.remove(p.mesh);
    }
    const allColliders = this.grid.clearColliders();
    for (const c of allColliders) {
      this.scene.remove(c.mesh);
    }
    const allRamps = this.grid.clearRamps();
    for (const r of allRamps) {
      this.scene.remove(r.mesh);
    }
    const allSpawns = this.grid.clearSpawns();
    for (const s of allSpawns) {
      this.scene.remove(s.mesh);
    }
    this.updateInfo();
  }

  private resizeGrid(width: number, depth: number): void {
    this.clearAll();
    this.grid.width = width;
    this.grid.depth = depth;
    this.grid.createVisuals(this.scene);
    this.updateOrbitTarget();
  }

  private updateOrbitTarget(): void {
    const totalX = this.grid.width * this.grid.cellSize;
    const totalZ = this.grid.depth * this.grid.cellSize;
    this.controls.target.set(totalX / 2, 0, totalZ / 2);
    this.controls.update();
  }

  private updateInfo(): void {
    const rot = this.activeModel
      ? { x: this.ghostRotationX, y: this.ghostRotationY, z: this.ghostRotationZ }
      : undefined;
    this.ui?.updateInfo(
      this.activeModel,
      this.grid.placementCount,
      rot,
      this.collisionMode,
      this.grid.colliderCount,
      this.spawnMode,
      this.spawnRole,
      this.rampMode,
      this.grid.rampCount,
    );
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
