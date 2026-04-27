import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonGradientMap } from "../render/ToonGradient.js";

interface PlacementEntry {
  modelName: string;
  x: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale?: number;
}

interface LevelExport {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  placements: PlacementEntry[];
}

/** Texture pair for GLB models: name → diffuse + normal paths */
const GLB_TEXTURES: Record<string, { diffuse: string; normal: string }> = {
  lantern: { diffuse: "/lantern_texture_diffuse.jpg", normal: "/lantern_texture_normal.jpg" },
  basin: { diffuse: "/basin_texture_diffuse.jpg", normal: "/basin_texture_normal.jpg" },
  tree: { diffuse: "/tree_texture_diffuse.jpg", normal: "/tree_texture_normal.jpg" },
  torch: { diffuse: "/torch_texture_diffuse.jpg", normal: "/torch_texture_normal.jpg" },
};

/** Names that should be loaded as GLB from root public/ */
const GLB_MODELS = new Set(Object.keys(GLB_TEXTURES));

/** Scale factor applied to all level geometry (editor units → game units) */
const LEVEL_SCALE = 3;

/** Model name prefixes that use the ishigaki stone texture */
const ISHIGAKI_PREFIXES = ['wall_', 'water_'];

function useIshigaki(name: string): boolean {
  return ISHIGAKI_PREFIXES.some((p) => name.startsWith(p));
}

export interface LevelDimensions {
  width: number;
  depth: number;
}

export class LevelLoader {
  private modelCache = new Map<string, THREE.Object3D>();
  private objFallbackMaterial: THREE.MeshToonMaterial | null = null;
  private ishigakiMaterial: THREE.MeshToonMaterial | null = null;

  async load(scene: THREE.Scene, url: string): Promise<LevelDimensions> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch level: ${url}`);
    const data: LevelExport = await res.json();

    // Preload all unique model names
    const uniqueNames = [...new Set(data.placements.map((p) => p.modelName))];
    await Promise.all(uniqueNames.map((name) => this.preloadModel(name)));

    // Place all models (skip lanterns — rendered by LightingManager)
    for (const p of data.placements) {
      if (p.modelName === "lantern") continue;
      const template = this.modelCache.get(p.modelName);
      if (!template) continue;

      const clone = template.clone();
      clone.scale.setScalar(LEVEL_SCALE * (p.scale ?? 1));
      clone.position.set(p.x * LEVEL_SCALE, 0, p.z * LEVEL_SCALE);
      clone.rotation.set(p.rotationX ?? 0, p.rotationY ?? 0, p.rotationZ ?? 0);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(clone);
    }

    return {
      width: data.gridWidth * (data.cellSize ?? 1) * LEVEL_SCALE,
      depth: data.gridDepth * (data.cellSize ?? 1) * LEVEL_SCALE,
    };
  }

  private async preloadModel(name: string): Promise<void> {
    if (this.modelCache.has(name)) return;

    const raw = GLB_MODELS.has(name)
      ? await this.loadGLB(name)
      : await this.loadOBJ(name);

    // Merge all sub-meshes into a single mesh to reduce draw calls
    const merged = this.mergeModel(raw);

    // Align min-corner to local origin (same as editor)
    const box = new THREE.Box3().setFromObject(merged);
    merged.position.set(-box.min.x, -box.min.y, -box.min.z);

    const wrapper = new THREE.Group();
    wrapper.add(merged);
    this.modelCache.set(name, wrapper);
  }

  /** Merge all meshes sharing the same material into single meshes */
  private mergeModel(root: THREE.Object3D): THREE.Object3D {
    // Collect all meshes grouped by material
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const mat = child.material as THREE.Material;
        // Clone geometry and apply the mesh's world transform so positions are correct
        const geo = child.geometry.clone();
        child.updateWorldMatrix(true, false);
        geo.applyMatrix4(child.matrixWorld);
        if (!byMaterial.has(mat)) byMaterial.set(mat, []);
        byMaterial.get(mat)!.push(geo);
      }
    });

    if (byMaterial.size === 0) return root;

    const group = new THREE.Group();

    for (const [material, geometries] of byMaterial) {
      if (geometries.length === 0) continue;

      // Ensure all geometries have matching attributes for merge
      const merged = geometries.length === 1
        ? geometries[0]
        : mergeGeometries(geometries, false);

      if (!merged) continue;

      const mesh = new THREE.Mesh(merged, material);
      group.add(mesh);
    }

    return group;
  }

  private async loadGLB(name: string): Promise<THREE.Object3D> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const tex = GLB_TEXTURES[name];

    const [gltf, diffuse, normal] = await Promise.all([
      loader.loadAsync(`/${name}.glb`),
      texLoader.loadAsync(tex.diffuse),
      texLoader.loadAsync(tex.normal),
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
      }
    });

    return gltf.scene;
  }

  private async loadOBJ(name: string): Promise<THREE.Object3D> {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/map_pieces/");

    let materials: MTLLoader.MaterialCreator | null = null;
    try {
      materials = await mtlLoader.loadAsync(`${name}.mtl`);
      materials.preload();
    } catch {
      // MTL empty or missing
    }

    const objLoader = new OBJLoader();
    if (materials) objLoader.setMaterials(materials);

    const obj = await objLoader.loadAsync(`/map_pieces/${name}.obj`);

    // Check if MTL provided real textures
    let hasRealMaterial = false;
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.Material;
        if (mat && "map" in mat && (mat as THREE.MeshPhongMaterial).map) {
          hasRealMaterial = true;
        }
      }
    });

    if (!hasRealMaterial) {
      const mat = useIshigaki(name)
        ? await this.getIshigakiMaterial()
        : await this.getObjFallbackMaterial();
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = mat;
        }
      });
    }

    return obj;
  }

  private async getIshigakiMaterial(): Promise<THREE.MeshToonMaterial> {
    if (this.ishigakiMaterial) return this.ishigakiMaterial;

    const texLoader = new THREE.TextureLoader();
    const [colorMap, normalMap] = await Promise.all([
      texLoader.loadAsync("/buildings/ishigaki_moat_ground_color.png"),
      texLoader.loadAsync("/buildings/ishigaki_moat_ground_normal.png"),
    ]);

    colorMap.colorSpace = THREE.SRGBColorSpace;

    this.ishigakiMaterial = new THREE.MeshToonMaterial({
      map: colorMap,
      normalMap,
      gradientMap: toonGradientMap,
    });

    return this.ishigakiMaterial;
  }

  private async getObjFallbackMaterial(): Promise<THREE.MeshToonMaterial> {
    if (this.objFallbackMaterial) return this.objFallbackMaterial;

    const texLoader = new THREE.TextureLoader();
    const [colorMap, normalMap] = await Promise.all([
      texLoader.loadAsync("/buildings/tenshu_gate_color.png"),
      texLoader.loadAsync("/buildings/tenshu_gate_normal.png"),
    ]);

    colorMap.colorSpace = THREE.SRGBColorSpace;

    this.objFallbackMaterial = new THREE.MeshToonMaterial({
      map: colorMap,
      normalMap,
      gradientMap: toonGradientMap,
    });

    return this.objFallbackMaterial;
  }
}
