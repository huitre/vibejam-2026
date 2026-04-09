import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MAP } from "../../shared/constants.js";
import { toonGradientMap } from "../render/ToonGradient.js";

// ─── Layout data (matches server WALL_COLLIDERS) ────────────────────────────

const BUILDINGS = [
  { x: 5, z: 5, w: 20, d: 13, h: 5 },       // South room west
  { x: 55, z: 5, w: 20, d: 13, h: 5 },       // South room east
  { x: 3, z: 28, w: 15, d: 34, h: 5 },       // West wing
  { x: 62, z: 28, w: 15, d: 34, h: 5 },      // East wing
  { x: 15, z: 75, w: 50, d: 20, h: 6 },      // Main hall (taller)
  { x: 20, z: 95, w: 40, d: 5, h: 5 },       // Back rooms
  { x: 5, z: 78, w: 10, d: 12, h: 5 },       // Ear room west
  { x: 65, z: 78, w: 10, d: 12, h: 5 },      // Ear room east
];

const CORRIDORS = [
  { startX: 5, startZ: 18, endX: 5, endZ: 28 },
  { startX: 5, startZ: 62, endX: 5, endZ: 75 },
  { startX: 75, startZ: 18, endX: 75, endZ: 28 },
  { startX: 75, startZ: 62, endX: 75, endZ: 75 },
  { startX: 25, startZ: 18, endX: 55, endZ: 18 },
  { startX: 18, startZ: 75, endX: 15, endZ: 75 },
  { startX: 65, startZ: 75, endX: 62, endZ: 75 },
];

const CORRIDOR_WIDTH = 4;
const CORRIDOR_HEIGHT = 3.5;

// ─── Piece template ─────────────────────────────────────────────────────────

interface PieceTemplate {
  object: THREE.Object3D;
  width: number;   // X extent at scale
  height: number;  // Y extent at scale
  depth: number;   // Z extent at scale
}

// Wall panel raw height ≈ 0.186 → target 3 m (stack 2 rows for 6 m walls)
const BASE_SCALE = 3 / 0.186; // ≈ 16.13

const PIECE_NAMES = [
  "geometry_0",
  "roof_with_supports", "roof_main_support_truss", "roof_i_beam_support",
  "roof_pillar", "roof_froof_support", "roof_pavillon", "roof_top_support",
  "solid_foundation", "walkway", "floor",
  "wall_shoji_2x2", "wall_shoji_4x4", "wall_wood",
  "wall_open_frame", "pillar_and_open_frame", "pillar_wood",
  "wall_open_frame_2",
  "roof_no_support_s", "roof_no_support_m", "roof_no_sipport_xs",
];

// ─── Builder ─────────────────────────────────────────────────────────────────

export class EnvironmentBuilder {
  private pieces = new Map<string, PieceTemplate>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ── Load & extract ──────────────────────────────────────────────────────

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const [gltf, diffuse, normal] = await Promise.all([
      loader.loadAsync("/japanese_buildings.glb"),
      texLoader.loadAsync("/buildings_texture_diffuse.jpg"),
      texLoader.loadAsync("/buildings_texture_normal.jpg"),
    ]);

    diffuse.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.LinearSRGBColorSpace;
    diffuse.flipY = false;
    normal.flipY = false;

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshToonMaterial({
          map: diffuse,
          normalMap: normal,
          gradientMap: toonGradientMap,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    for (const name of PIECE_NAMES) {
      this.extractPiece(gltf.scene, name);
    }
  }

  private extractPiece(model: THREE.Group, name: string): void {
    const obj = model.getObjectByName(name);
    if (!obj) {
      console.warn("Piece not found:", name);
      return;
    }

    const clone = obj.clone(true);
    const wrapper = new THREE.Group();
    wrapper.add(clone);

    // Center at origin, bottom at y = 0
    const box = new THREE.Box3().setFromObject(wrapper);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.x -= center.x;
    clone.position.y -= box.min.y;
    clone.position.z -= center.z;

    wrapper.scale.setScalar(BASE_SCALE);

    // Measure scaled dimensions
    const scaledBox = new THREE.Box3().setFromObject(wrapper);
    const size = new THREE.Vector3();
    scaledBox.getSize(size);

    this.pieces.set(name, {
      object: wrapper,
      width: size.x,
      height: size.y,
      depth: size.z,
    });
  }

  // ── Placement helpers ───────────────────────────────────────────────────

  private clone(name: string, x: number, y: number, z: number, rotY = 0): THREE.Object3D | null {
    const tpl = this.pieces.get(name);
    if (!tpl) return null;
    const c = tpl.object.clone(true);
    c.position.set(x, y, z);
    c.rotation.y = rotY;
    this.scene.add(c);
    return c;
  }

  /** Tile wall panels between two XZ points. */
  private tileWall(
    panelName: string,
    x0: number, z0: number,
    x1: number, z1: number,
    wallHeight: number,
  ): void {
    const panel = this.pieces.get(panelName);
    if (!panel) return;

    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length < 0.01) return;

    // Rotation so panel X axis aligns with wall direction
    const rotY = Math.atan2(-dz, dx);

    const cols = Math.max(1, Math.round(length / panel.width));
    const rows = Math.max(1, Math.round(wallHeight / panel.height));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = (c + 0.5) / cols;
        this.clone(
          panelName,
          x0 + dx * t,
          r * panel.height,
          z0 + dz * t,
          rotY,
        );
      }
    }
  }

  /** Tile floor / walkway pieces over a rectangular area. */
  private tileFloor(pieceName: string, x: number, z: number, w: number, d: number, y = 0): void {
    const piece = this.pieces.get(pieceName);
    if (!piece) return;

    const colsX = Math.max(1, Math.round(w / piece.width));
    const colsZ = Math.max(1, Math.round(d / piece.depth));

    for (let ix = 0; ix < colsX; ix++) {
      for (let iz = 0; iz < colsZ; iz++) {
        this.clone(
          pieceName,
          x + (ix + 0.5) * (w / colsX),
          y,
          z + (iz + 0.5) * (d / colsZ),
        );
      }
    }
  }

  /** Tile roof pieces over a building footprint. */
  private tileRoof(roofName: string, x: number, z: number, w: number, d: number, h: number): void {
    const roof = this.pieces.get(roofName);
    if (!roof) return;

    const colsX = Math.max(1, Math.round(w / roof.width));
    const colsZ = Math.max(1, Math.round(d / roof.depth));

    for (let ix = 0; ix < colsX; ix++) {
      for (let iz = 0; iz < colsZ; iz++) {
        this.clone(
          roofName,
          x + (ix + 0.5) * (w / colsX),
          h,
          z + (iz + 0.5) * (d / colsZ),
        );
      }
    }
  }

  // ── High-level builders ─────────────────────────────────────────────────

  build(): void {
    this.buildPerimeter();
    this.buildSpiritWall();
    this.buildBuildings();
    this.buildCorridors();
    this.buildGate();
  }

  // ── Perimeter walls ──────────────────────────────────────────────────────

  private buildPerimeter(): void {
    const h = MAP.WALL_HEIGHT;

    // West wall
    this.tileWall("wall_wood", 0, 0, 0, MAP.DEPTH, h);
    // East wall
    this.tileWall("wall_wood", MAP.WIDTH, 0, MAP.WIDTH, MAP.DEPTH, h);
    // North wall
    this.tileWall("wall_wood", 0, MAP.DEPTH, MAP.WIDTH, MAP.DEPTH, h);
    // South wall (gap 36‑44 for gate)
    this.tileWall("wall_wood", 0, 0, 36, 0, h);
    this.tileWall("wall_wood", 44, 0, MAP.WIDTH, 0, h);
  }

  // ── Spirit wall ──────────────────────────────────────────────────────────

  private buildSpiritWall(): void {
    this.tileWall("wall_wood", 34, 6.5, 46, 6.5, 4);
  }

  // ── Buildings ────────────────────────────────────────────────────────────

  private buildBuildings(): void {
    for (const b of BUILDINGS) {
      this.buildOneBuilding(b.x, b.z, b.w, b.d, b.h);
    }
  }

  private buildOneBuilding(x: number, z: number, w: number, d: number, h: number): void {
    // Choose wall style: shoji for larger, open frame mix for smaller
    const wallType = w >= 20 || d >= 20 ? "wall_shoji_4x4" : "wall_shoji_2x2";

    // Four walls
    this.tileWall(wallType, x, z, x + w, z, h);         // south
    this.tileWall(wallType, x, z + d, x + w, z + d, h); // north
    this.tileWall(wallType, x, z, x, z + d, h);         // west
    this.tileWall(wallType, x + w, z, x + w, z + d, h); // east

    // Floor
    this.tileFloor("floor", x, z, w, d, 0.05);

    // Pillars at corners
    this.placePillar(x, 0, z, h);
    this.placePillar(x + w, 0, z, h);
    this.placePillar(x, 0, z + d, h);
    this.placePillar(x + w, 0, z + d, h);

    // Pillars along long edges (every ~5 m)
    const spacingX = 5;
    const spacingZ = 5;
    const pillarsX = Math.max(0, Math.floor(w / spacingX) - 1);
    const pillarsZ = Math.max(0, Math.floor(d / spacingZ) - 1);

    for (let i = 1; i <= pillarsX; i++) {
      this.placePillar(x + i * (w / (pillarsX + 1)), 0, z, h);
      this.placePillar(x + i * (w / (pillarsX + 1)), 0, z + d, h);
    }
    for (let i = 1; i <= pillarsZ; i++) {
      this.placePillar(x, 0, z + i * (d / (pillarsZ + 1)), h);
      this.placePillar(x + w, 0, z + i * (d / (pillarsZ + 1)), h);
    }

    // Roof
    const roofName = this.pickRoof(w, d);
    this.tileRoof(roofName, x, z, w, d, h);
  }

  private pickRoof(w: number, d: number): string {
    const area = w * d;
    if (area >= 800) return "roof_pavillon";
    if (area >= 300) return "roof_with_supports";
    if (area >= 100) return "roof_no_support_s";
    return "roof_no_sipport_xs";
  }

  private placePillar(x: number, y: number, z: number, targetH: number): void {
    const tpl = this.pieces.get("pillar_wood");
    if (!tpl) return;
    const c = tpl.object.clone(true);
    c.position.set(x, y, z);
    // Stretch pillar to target height
    const scaleY = targetH / tpl.height;
    c.scale.y *= scaleY;
    this.scene.add(c);
  }

  // ── Corridors ────────────────────────────────────────────────────────────

  private buildCorridors(): void {
    for (const cor of CORRIDORS) {
      this.buildOneCorridor(cor.startX, cor.startZ, cor.endX, cor.endZ);
    }
  }

  private buildOneCorridor(x0: number, z0: number, x1: number, z1: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.sqrt(dx * dx + dz * dz);
    const isH = Math.abs(dx) > Math.abs(dz);
    const centerX = (x0 + x1) / 2;
    const centerZ = (z0 + z1) / 2;

    // Walkway floor
    const floorW = isH ? length : CORRIDOR_WIDTH;
    const floorD = isH ? CORRIDOR_WIDTH : length;
    this.tileFloor("walkway", centerX - floorW / 2, centerZ - floorD / 2, floorW, floorD, 0.02);

    // Roof
    const roofName = "roof_no_sipport_xs";
    const roof = this.pieces.get(roofName);
    if (roof) {
      const rw = isH ? length : CORRIDOR_WIDTH + 2;
      const rd = isH ? CORRIDOR_WIDTH + 2 : length;
      const rx = centerX - rw / 2;
      const rz = centerZ - rd / 2;
      this.tileRoof(roofName, rx, rz, rw, rd, CORRIDOR_HEIGHT);
    }

    // Pillars along each side
    const pillarSpacing = 4;
    const count = Math.max(2, Math.floor(length / pillarSpacing) + 1);

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const px = x0 + dx * t;
      const pz = z0 + dz * t;

      const perpX = isH ? 0 : CORRIDOR_WIDTH / 2;
      const perpZ = isH ? CORRIDOR_WIDTH / 2 : 0;

      this.clone("roof_pillar", px - perpX, 0, pz - perpZ);
      this.clone("roof_pillar", px + perpX, 0, pz + perpZ);
    }
  }

  // ── Gate ─────────────────────────────────────────────────────────────────

  private buildGate(): void {
    const gateH = MAP.WALL_HEIGHT + 1;

    // Use pillar_and_open_frame for the gate structure
    const piece = this.pieces.get("pillar_and_open_frame");
    if (piece) {
      const ratio = gateH / piece.height;

      // Left gate pillar
      const left = piece.object.clone(true);
      left.position.set(36, 0, 0);
      left.scale.multiplyScalar(ratio);
      this.scene.add(left);

      // Right gate pillar
      const right = piece.object.clone(true);
      right.position.set(44, 0, 0);
      right.scale.multiplyScalar(ratio);
      this.scene.add(right);
    }

    // Roof over gate
    this.clone("roof_with_supports", 40, gateH - 1, 0);
  }
}
