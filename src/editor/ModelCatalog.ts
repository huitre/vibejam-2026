import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const MODEL_COUNT = 156;
const TEXTURE_BASE = '/buildings/';

export class ModelCatalog {
  private cache = new Map<string, THREE.Group>();
  private loadingPromises = new Map<string, Promise<THREE.Group>>();
  private material: THREE.MeshStandardMaterial | null = null;
  private materialPromise: Promise<THREE.MeshStandardMaterial> | null = null;
  private loader = new OBJLoader();

  // Offscreen preview renderer
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene = new THREE.Scene();
  private previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  constructor() {
    this.previewScene.background = new THREE.Color(0x1a1a2e);
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 5, 3);
    this.previewScene.add(ambLight, dirLight);
  }

  getModelNames(): string[] {
    const names: string[] = [];
    for (let i = 0; i < MODEL_COUNT; i++) names.push(`model_${i}`);
    return names;
  }

  private async loadMaterial(): Promise<THREE.MeshStandardMaterial> {
    if (this.material) return this.material;
    if (this.materialPromise) return this.materialPromise;

    this.materialPromise = new Promise((resolve) => {
      const texLoader = new THREE.TextureLoader();
      const colorMap = texLoader.load(`${TEXTURE_BASE}tenshu_gate_color.png`);
      const normalMap = texLoader.load(`${TEXTURE_BASE}tenshu_gate_normal.png`);
      const roughnessMap = texLoader.load(`${TEXTURE_BASE}tenshu_gate_roughness.png`);

      colorMap.colorSpace = THREE.SRGBColorSpace;

      this.material = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap,
        roughnessMap,
      });
      resolve(this.material);
    });

    return this.materialPromise;
  }

  async loadModel(name: string): Promise<THREE.Group> {
    const cached = this.cache.get(name);
    if (cached) return cached.clone();

    const existing = this.loadingPromises.get(name);
    if (existing) {
      const group = await existing;
      return group.clone();
    }

    const promise = (async () => {
      const mat = await this.loadMaterial();
      const url = `${TEXTURE_BASE}${name}.obj`;
      const obj = await this.loader.loadAsync(url);

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = mat;
        }
      });

      this.cache.set(name, obj);
      return obj;
    })();

    this.loadingPromises.set(name, promise);
    const group = await promise;
    return group.clone();
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

    this.previewRenderer.render(this.previewScene, this.previewCamera);

    return this.previewRenderer.domElement.toDataURL('image/png');
  }

  createGhost(original: THREE.Group): THREE.Group {
    const ghost = original.clone();
    ghost.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
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
