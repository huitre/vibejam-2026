import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** OBJ models in /map_pieces/ (loaded with MTL + fallback texture) */
const OBJ_MODELS = [
  "base_map",
  "bridge",
  "tower",
  "front_gate",
  "gate_big",
  "gate_door",
  "corner_tower",
  "castle_wall_corner",
  "castle_wall",
  "castle_tower",
  "tree_1",
  "wall_corner_l",
  "wall_corner_m",
  "wall_l",
  "wall_m",
  "water_bridge",
  "water_canal",
  "water_canal_s",
  "water_corner",
  "water_end",
  "well",
];

/** GLB models in /public root (keep their own materials) */
const GLB_MODELS = ["lantern", "basin", "tree", "torch"];

interface ModelDef {
  name: string;
  type: "obj" | "glb";
  path: string;
}

function buildModelDefs(): ModelDef[] {
  const defs: ModelDef[] = [];
  for (const name of OBJ_MODELS) {
    defs.push({ name, type: "obj", path: `/map_pieces/${name}.obj` });
  }
  for (const name of GLB_MODELS) {
    defs.push({ name, type: "glb", path: `/${name}.glb` });
  }
  return defs;
}

const MODEL_DEFS = buildModelDefs();

/** Model name prefixes that use the ishigaki stone texture */
const ISHIGAKI_PREFIXES = ["wall_", "water_"];

function useIshigaki(name: string): boolean {
  return ISHIGAKI_PREFIXES.some((p) => name.startsWith(p));
}

export class ModelCatalog {
  private cache = new Map<string, THREE.Group>();
  private loadingPromises = new Map<string, Promise<THREE.Group>>();
  private fallbackMaterial: THREE.MeshStandardMaterial | null = null;
  private fallbackPromise: Promise<THREE.MeshStandardMaterial> | null = null;
  private ishigakiMaterial: THREE.MeshStandardMaterial | null = null;
  private ishigakiPromise: Promise<THREE.MeshStandardMaterial> | null = null;

  // Offscreen preview renderer
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene = new THREE.Scene();
  private previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);

  constructor() {
    this.previewScene.background = new THREE.Color(0x1a1a2e);
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 5, 3);
    this.previewScene.add(ambLight, dirLight);
  }

  getModelNames(): string[] {
    return MODEL_DEFS.map((d) => d.name);
  }

  private getDef(name: string): ModelDef | undefined {
    return MODEL_DEFS.find((d) => d.name === name);
  }

  private async loadFallbackMaterial(): Promise<THREE.MeshStandardMaterial> {
    if (this.fallbackMaterial) return this.fallbackMaterial;
    if (this.fallbackPromise) return this.fallbackPromise;

    this.fallbackPromise = new Promise((resolve) => {
      const texLoader = new THREE.TextureLoader();
      const colorMap = texLoader.load("/buildings/tenshu_gate_color.png");
      const normalMap = texLoader.load("/buildings/tenshu_gate_normal.png");
      const roughnessMap = texLoader.load(
        "/buildings/tenshu_gate_roughness.png",
      );

      colorMap.colorSpace = THREE.SRGBColorSpace;

      this.fallbackMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap,
        roughnessMap,
      });
      resolve(this.fallbackMaterial);
    });

    return this.fallbackPromise;
  }

  private async loadIshigakiMaterial(): Promise<THREE.MeshStandardMaterial> {
    if (this.ishigakiMaterial) return this.ishigakiMaterial;
    if (this.ishigakiPromise) return this.ishigakiPromise;

    this.ishigakiPromise = new Promise((resolve) => {
      const texLoader = new THREE.TextureLoader();
      const colorMap = texLoader.load(
        "/buildings/ishigaki_moat_ground_color.png",
      );
      const normalMap = texLoader.load(
        "/buildings/ishigaki_moat_ground_normal.png",
      );
      const roughnessMap = texLoader.load(
        "/buildings/ishigaki_moat_ground_roughness.png",
      );

      colorMap.colorSpace = THREE.SRGBColorSpace;

      this.ishigakiMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap,
        roughnessMap,
      });
      resolve(this.ishigakiMaterial);
    });

    return this.ishigakiPromise;
  }

  async loadModel(name: string): Promise<THREE.Group> {
    const cached = this.cache.get(name);
    if (cached) return cached.clone();

    const existing = this.loadingPromises.get(name);
    if (existing) {
      const group = await existing;
      return group.clone();
    }

    const def = this.getDef(name);
    if (!def) throw new Error(`Unknown model: ${name}`);

    const promise = def.type === "glb" ? this.loadGLB(def) : this.loadOBJ(def);

    this.loadingPromises.set(name, promise);
    const group = await promise;
    return group.clone();
  }

  private async loadOBJ(def: ModelDef): Promise<THREE.Group> {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/map_pieces/");

    let materials: MTLLoader.MaterialCreator | null = null;
    try {
      materials = await mtlLoader.loadAsync(`${def.name}.mtl`);
      materials.preload();
    } catch {
      // MTL load failed, will use fallback
    }

    const objLoader = new OBJLoader();
    if (materials) {
      objLoader.setMaterials(materials);
    }

    const obj = await objLoader.loadAsync(def.path);

    // Check if MTL provided real materials with textures
    let hasRealMaterial = false;
    if (materials) {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.Material;
          if (mat && "map" in mat && (mat as THREE.MeshPhongMaterial).map) {
            hasRealMaterial = true;
          }
        }
      });
    }

    if (!hasRealMaterial) {
      const mat = useIshigaki(def.name)
        ? await this.loadIshigakiMaterial()
        : await this.loadFallbackMaterial();
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = mat;
        }
      });
    }

    return this.centerAndWrap(obj, def.name);
  }

  private async loadGLB(def: ModelDef): Promise<THREE.Group> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(def.path);
    const root = gltf.scene;
    return this.centerAndWrap(root, def.name);
  }

  private centerAndWrap(obj: THREE.Object3D, name: string): THREE.Group {
    // Align min-corner (bottom-left) to local origin so the grid point = bottom-left edge.
    // This lets pieces of different sizes align their edges at grid boundaries.
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.set(-box.min.x, -box.min.y, -box.min.z);

    const wrapper = new THREE.Group();
    wrapper.add(obj);

    this.cache.set(name, wrapper);
    return wrapper;
  }

  async renderPreview(name: string): Promise<string> {
    if (!this.previewRenderer) {
      this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
      this.previewRenderer.setSize(256, 256);
    }

    const model = await this.loadModel(name);

    // Remove previous preview models
    const toRemove: THREE.Object3D[] = [];
    this.previewScene.traverse((child) => {
      if (child.userData.__preview__) toRemove.push(child);
    });
    toRemove.forEach((c) => this.previewScene.remove(c));

    model.userData.__preview__ = true;
    this.previewScene.add(model);

    // Fit camera to model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.8;

    this.previewCamera.position.set(
      center.x + dist * 0.6,
      center.y + dist * 0.5,
      center.z + dist * 0.6,
    );
    this.previewCamera.lookAt(center);
    this.previewCamera.far = dist * 4;
    this.previewCamera.updateProjectionMatrix();

    this.previewRenderer.render(this.previewScene, this.previewCamera);

    return this.previewRenderer.domElement.toDataURL("image/png");
  }

  createGhost(original: THREE.Group): THREE.Group {
    const ghost = original.clone();
    ghost.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const srcMat = mesh.material as THREE.Material;
        const mat = srcMat.clone() as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = 0.5;
        mat.depthWrite = false;
        mesh.material = mat;
      }
    });
    ghost.userData.__ghost__ = true;
    return ghost;
  }
}
