import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "./ToonGradient.js";

/** Matches the Colyseus ProjectileState schema (synced fields only) */
interface ProjectileState {
  x: number;
  y: number;
  z: number;
  kind: string;          // "water_bomb" | "smoke_bomb"  — server field name
  targetX: number;
  targetZ: number;
  active: boolean;
}

interface ActiveProjectile {
  mesh: THREE.Object3D;
  state: ProjectileState;
}

const PROJECTILE_COLORS: Record<string, number> = {
  water_bomb: 0x4488ff,
  smoke_bomb: 0x888888,
};

const BOMB_TARGET_SIZE = 0.5; // meters

export class EffectRenderer {
  private scene: THREE.Scene;
  private projectiles = new Map<string, ActiveProjectile>();

  // Preloaded bomb models + their computed scale
  private waterBombModel: THREE.Group | null = null;
  private waterBombScale = 1;
  private smokeBombModel: THREE.Group | null = null;
  private smokeBombScale = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async loadModels(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const prepareTextures = (diffuse: THREE.Texture, normal: THREE.Texture, pbr: THREE.Texture) => {
      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      pbr.colorSpace = THREE.LinearSRGBColorSpace;
      diffuse.flipY = false;
      normal.flipY = false;
      pbr.flipY = false;
    };

    const applyToonMaterial = (model: THREE.Group, diffuse: THREE.Texture, normal: THREE.Texture) => {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshToonMaterial({
            map: diffuse,
            normalMap: normal,
            gradientMap: toonGradientMap,
          });
          child.castShadow = true;
        }
      });
    };

    const computeScale = (model: THREE.Group): number => {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      return maxDim > 0 ? BOMB_TARGET_SIZE / maxDim : 1;
    };

    const [waterResult, smokeResult] = await Promise.allSettled([
      Promise.all([
        gltfLoader.loadAsync("/water_bomb.glb"),
        texLoader.loadAsync("/water_bomb_texture_diffuse.jpg"),
        texLoader.loadAsync("/water_bomb_texture_normal.jpg"),
        texLoader.loadAsync("/water_bomb_texture_pbr.jpg"),
      ]),
      Promise.all([
        gltfLoader.loadAsync("/smoke_bomb.glb"),
        texLoader.loadAsync("/smoke_bomb_texture_diffuse.jpg"),
        texLoader.loadAsync("/smoke_bomb_texture_normal.jpg"),
        texLoader.loadAsync("/smoke_bomb_texture_pbr.jpg"),
      ]),
    ]);

    if (waterResult.status === "fulfilled") {
      const [gltf, diffuse, normal, pbr] = waterResult.value;
      prepareTextures(diffuse, normal, pbr);
      this.waterBombModel = gltf.scene;
      applyToonMaterial(this.waterBombModel, diffuse, normal);
      this.waterBombScale = computeScale(this.waterBombModel);
      const wb = new THREE.Box3().setFromObject(this.waterBombModel);
      const ws = new THREE.Vector3(); wb.getSize(ws);
      console.log(`[EffectRenderer] water_bomb native size: ${ws.x.toFixed(3)} x ${ws.y.toFixed(3)} x ${ws.z.toFixed(3)}, computed scale: ${this.waterBombScale.toFixed(4)}, final size: ${(Math.max(ws.x,ws.y,ws.z)*this.waterBombScale).toFixed(3)}`);
    } else {
      console.warn("Failed to load water_bomb model/textures", waterResult.reason);
    }

    if (smokeResult.status === "fulfilled") {
      const [gltf, diffuse, normal, pbr] = smokeResult.value;
      prepareTextures(diffuse, normal, pbr);
      this.smokeBombModel = gltf.scene;
      applyToonMaterial(this.smokeBombModel, diffuse, normal);
      this.smokeBombScale = computeScale(this.smokeBombModel);
      const sb = new THREE.Box3().setFromObject(this.smokeBombModel);
      const ss = new THREE.Vector3(); sb.getSize(ss);
      console.log(`[EffectRenderer] smoke_bomb native size: ${ss.x.toFixed(3)} x ${ss.y.toFixed(3)} x ${ss.z.toFixed(3)}, computed scale: ${this.smokeBombScale.toFixed(4)}, final size: ${(Math.max(ss.x,ss.y,ss.z)*this.smokeBombScale).toFixed(3)}`);
    } else {
      console.warn("Failed to load smoke_bomb model/textures", smokeResult.reason);
    }
  }

  addProjectile(id: string, state: ProjectileState): void {
    if (this.projectiles.has(id)) return;

    const isWater = state.kind === "water_bomb";
    const baseModel = isWater ? this.waterBombModel : this.smokeBombModel;
    const modelScale = isWater ? this.waterBombScale : this.smokeBombScale;

    let mesh: THREE.Object3D;
    if (baseModel) {
      const clone = baseModel.clone(true);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = (child.material as THREE.Material).clone();
          child.castShadow = true;
        }
      });
      clone.scale.setScalar(modelScale);
      clone.position.set(state.x, state.y, state.z);
      console.log(`[EffectRenderer] addProjectile ${id}: GLB (${state.kind}), scale=${modelScale.toFixed(4)}, pos=(${state.x.toFixed(1)}, ${state.y.toFixed(1)}, ${state.z.toFixed(1)})`);
      mesh = clone;
    } else {
      console.log(`[EffectRenderer] addProjectile ${id}: FALLBACK sphere (no model for ${state.kind})`);
      const color = PROJECTILE_COLORS[state.kind] ?? 0xffffff;
      const geometry = new THREE.SphereGeometry(0.15, 8, 8);
      const material = new THREE.MeshToonMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        gradientMap: toonGradientMap,
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(state.x, state.y, state.z);
      (mesh as THREE.Mesh).castShadow = true;
    }

    this.scene.add(mesh);
    this.projectiles.set(id, { mesh, state });
  }

  removeProjectile(id: string): void {
    const proj = this.projectiles.get(id);
    if (!proj) return;

    this.scene.remove(proj.mesh);
    proj.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    this.projectiles.delete(id);
  }

  update(dt: number): void {
    for (const proj of this.projectiles.values()) {
      const s = proj.state;

      // Position comes directly from server-synced x/y/z (includes parabolic arc)
      proj.mesh.position.set(s.x, s.y, s.z);

      // Spin the bomb during flight for visual effect
      const dtSec = dt / 1000;
      proj.mesh.rotation.x += 5.0 * dtSec;
      proj.mesh.rotation.z += 3.0 * dtSec;
    }
  }

  dispose(): void {
    for (const [id] of this.projectiles) {
      this.removeProjectile(id);
    }
  }
}
