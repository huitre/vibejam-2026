import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "../render/ToonGradient.js";

const CALTROP_COUNT = 8;
const RING_INNER_RADIUS = 0.3;
const FADE_START_MS = 3000;
const TARGET_SIZE = 0.25; // each caltrop ~25cm

interface CaltropInstance {
  group: THREE.Group;
  elapsedMs: number;
  durationMs: number;
}

export class CaltropVisual {
  private scene: THREE.Scene;
  private instances: CaltropInstance[] = [];
  private caltropModel: THREE.Group | null = null;
  private modelScale = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async loadModel(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    try {
      const [gltf, diffuse, normal] = await Promise.all([
        gltfLoader.loadAsync("/caltrops.glb"),
        texLoader.loadAsync("/caltrops_texture_diffuse.jpg"),
        texLoader.loadAsync("/caltrops_texture_normal.jpg"),
      ]);

      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      diffuse.flipY = false;
      normal.flipY = false;

      this.caltropModel = gltf.scene;
      this.caltropModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshToonMaterial({
            map: diffuse,
            normalMap: normal,
            gradientMap: toonGradientMap,
          });
          child.castShadow = true;
        }
      });

      // Compute scale so each caltrop fits TARGET_SIZE
      const box = new THREE.Box3().setFromObject(this.caltropModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      this.modelScale = maxDim > 0 ? TARGET_SIZE / maxDim : 1;
    } catch (err) {
      console.warn("Failed to load caltrops model/textures", err);
    }
  }

  createCaltrops(x: number, z: number, radius: number, durationMs: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0.01, z);

    for (let i = 0; i < CALTROP_COUNT; i++) {
      const angle = (i / CALTROP_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = RING_INNER_RADIUS + Math.random() * (radius - RING_INNER_RADIUS);
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;

      if (this.caltropModel) {
        const clone = this.caltropModel.clone(true);
        clone.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = (child.material as THREE.Material).clone();
            child.castShadow = true;
          }
        });
        clone.scale.setScalar(this.modelScale);
        clone.position.set(px, 0, pz);
        clone.rotation.y = Math.random() * Math.PI * 2;
        group.add(clone);
      } else {
        // Fallback: small cone
        const geo = new THREE.ConeGeometry(0.06, 0.3, 4);
        const mat = new THREE.MeshToonMaterial({ color: 0x888888, gradientMap: toonGradientMap });
        const spike = new THREE.Mesh(geo, mat);
        spike.position.set(px, 0.15, pz);
        spike.castShadow = true;
        group.add(spike);
      }
    }

    // Faint ground ring
    const ringGeo = new THREE.RingGeometry(radius - 0.1, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    this.scene.add(group);
    this.instances.push({ group, elapsedMs: 0, durationMs });
  }

  update(deltaMs: number): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      inst.elapsedMs += deltaMs;

      const remaining = inst.durationMs - inst.elapsedMs;

      if (remaining <= 0) {
        this.scene.remove(inst.group);
        inst.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
        this.instances.splice(i, 1);
        continue;
      }

      if (remaining < FADE_START_MS) {
        const alpha = remaining / FADE_START_MS;
        inst.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material;
            if (mat instanceof THREE.Material) {
              mat.transparent = true;
              mat.opacity = alpha;
            }
          }
        });
      }
    }
  }
}
