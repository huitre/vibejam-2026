import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GridSystem } from './GridSystem';
import { ModelCatalog } from './ModelCatalog';
import { EditorUI } from './EditorUI';
import { exportToJSON, importFromJSON, downloadJSON } from './LevelData';
import type { PlacementEntry } from './LevelData';

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

  constructor() {
    this.grid = new GridSystem(2, 40, 40);
    this.catalog = new ModelCatalog();
  }

  async init(): Promise<void> {
    this.initThree();
    this.initLights();
    this.grid.createVisuals(this.scene);
    this.initUI();
    this.initEvents();
    this.animate();
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
      if (e.key === 'y' || e.key === 'Y') this.rotateGhost('y');
      if (e.key === 'z' || e.key === 'Z') this.rotateGhost('z');
      if (e.key === 'Escape') this.deselect();
    });
  }

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

  private async onMouseMove(e: MouseEvent): Promise<void> {
    if (!this.activeModel) return;
    this.updateMouseFromEvent(e);

    const point = this.raycastGround();
    if (!point) return;

    const snapped = this.grid.snapToGrid(point.x, point.z);
    const { col, row } = this.grid.worldToGrid(point.x, point.z);
    if (!this.grid.isInBounds(col, row)) {
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
    if (!this.activeModel) return;
    this.updateMouseFromEvent(e);

    const point = this.raycastGround();
    if (!point) return;

    const { col, row } = this.grid.worldToGrid(point.x, point.z);
    if (!this.grid.isInBounds(col, row)) return;

    await this.placeModel(
      this.activeModel, col, row,
      this.ghostRotationX, this.ghostRotationY, this.ghostRotationZ,
    );
  }

  private onRightClick(e: MouseEvent): void {
    this.updateMouseFromEvent(e);

    const point = this.raycastGround();
    if (!point) return;

    const { col, row } = this.grid.worldToGrid(point.x, point.z);
    this.removeModel(col, row);
  }

  private async setActiveModel(name: string): Promise<void> {
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
    modelName: string, col: number, row: number,
    rotationX: number, rotationY: number, rotationZ: number,
  ): Promise<void> {
    // Remove existing model at that cell
    this.removeModel(col, row);

    const model = await this.catalog.loadModel(modelName);
    const pos = this.grid.gridToWorld(col, row);
    model.position.set(pos.x, 0, pos.z);
    model.rotation.set(rotationX, rotationY, rotationZ);
    this.scene.add(model);

    this.grid.place({ modelName, col, row, rotationX, rotationY, rotationZ, mesh: model });
    this.updateInfo();
  }

  removeModel(col: number, row: number): void {
    const removed = this.grid.remove(col, row);
    if (removed) {
      this.scene.remove(removed.mesh);
      this.updateInfo();
    }
  }

  exportLevel(): void {
    const placements: PlacementEntry[] = this.grid.getAllPlacements().map((p) => ({
      modelName: p.modelName,
      col: p.col,
      row: p.row,
      rotationX: p.rotationX,
      rotationY: p.rotationY,
      rotationZ: p.rotationZ,
    }));
    const json = exportToJSON(this.grid.width, this.grid.depth, this.grid.cellSize, placements);
    downloadJSON(json);
  }

  async importLevel(jsonStr: string): Promise<void> {
    try {
      const data = importFromJSON(jsonStr);
      // Clear current scene
      this.clearAll();

      // Resize grid
      this.grid.width = data.gridWidth;
      this.grid.depth = data.gridDepth;
      this.grid.cellSize = data.cellSize;
      this.grid.createVisuals(this.scene);
      this.updateOrbitTarget();

      // Place all models
      for (const p of data.placements) {
        await this.placeModel(
          p.modelName, p.col, p.row,
          p.rotationX ?? 0, p.rotationY, p.rotationZ ?? 0,
        );
      }

      // Update grid size inputs
      (document.getElementById('grid-width') as HTMLInputElement).value = String(data.gridWidth);
      (document.getElementById('grid-depth') as HTMLInputElement).value = String(data.gridDepth);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import level: ' + (err as Error).message);
    }
  }

  private clearAll(): void {
    const all = this.grid.clearAll();
    for (const p of all) {
      this.scene.remove(p.mesh);
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
    this.ui?.updateInfo(this.activeModel, this.grid.placementCount, rot);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
