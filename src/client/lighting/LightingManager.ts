import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LampObject } from "./LampObject.js";
import { LAMP, LIGHTING } from "../../shared/constants.js";
import { toonGradientMap } from "../render/ToonGradient.js";

/**
 * Light pooling: a fixed pool of N PointLights is moved to the nearest lit lamps each frame.
 * Three.js compiles shaders with NUM_POINT_LIGHTS = POOL_SIZE (constant),
 * so the per-pixel cost stays fixed regardless of total lamp count.
 */
const POOL_SIZE = 8;
const LIGHT_COLOR = 0xfff3ba;

interface RelightingEntry {
  startTime: number;
  duration: number;
}

export class LightingManager {
  private scene: THREE.Scene;
  private lamps = new Map<string, LampObject>();
  private lampList: LampObject[] = [];
  private pool: THREE.PointLight[] = [];
  private lanternModel: THREE.Group | null = null;
  private relightingLamps = new Map<string, RelightingEntry>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create fixed pool of PointLights once
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(LIGHT_COLOR, LIGHTING.LAMP_POOL_INTENSITY, LIGHTING.LAMP_POOL_RANGE);
      light.castShadow = false;
      light.position.set(0, -100, 0); // parked off-screen
      this.scene.add(light);
      this.pool.push(light);
    }
  }

  async loadModel(): Promise<void> {
    try {
      const [gltf, diffuse, normal, pbr] = await Promise.all([
        new GLTFLoader().loadAsync("/lantern.glb"),
        new THREE.TextureLoader().loadAsync("/lantern_texture_diffuse.jpg"),
        new THREE.TextureLoader().loadAsync("/lantern_texture_normal.jpg"),
        new THREE.TextureLoader().loadAsync("/lantern_texture_pbr.jpg"),
      ]);

      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      pbr.colorSpace = THREE.LinearSRGBColorSpace;

      diffuse.flipY = false;
      normal.flipY = false;
      pbr.flipY = false;

      this.lanternModel = gltf.scene;
      this.lanternModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshToonMaterial({
            map: diffuse,
            normalMap: normal,
            gradientMap: toonGradientMap,
          });
        }
      });
    } catch (e) {
      console.warn("Failed to load lantern.glb or textures, will use fallback geometry", e);
    }
  }

  addLamp(id: string, x: number, y: number, z: number, lit: boolean): void {
    if (this.lamps.has(id)) return;
    const lamp = new LampObject(x, y, z, lit, this.lanternModel);
    this.scene.add(lamp.getGroup());
    this.lamps.set(id, lamp);
    this.lampList.push(lamp);
  }

  setLampState(lampId: string, lit: boolean): void {
    const lamp = this.lamps.get(lampId);
    if (lamp) {
      lamp.setLit(lit);
    }
  }

  startRelighting(lampId: string, duration: number): void {
    this.relightingLamps.set(lampId, { startTime: performance.now(), duration });
  }

  cancelRelighting(lampId: string): void {
    this.relightingLamps.delete(lampId);
  }

  completeRelighting(lampId: string): void {
    this.relightingLamps.delete(lampId);
  }

  /** Move pool lights to the nearest lit lamps around the player */
  updateShadowBudget(playerPos: THREE.Vector3): void {
    const now = performance.now();

    // Sort lit lamps by distance to player
    const litLamps: { lamp: LampObject; dist: number; intensity: number }[] = [];
    for (const lamp of this.lampList) {
      const pos = lamp.getPosition();
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const dist = dx * dx + dz * dz;

      if (lamp.getLit()) {
        litLamps.push({ lamp, dist, intensity: LIGHTING.LAMP_POOL_INTENSITY });
        continue;
      }

      // Check if this lamp is being relit (gradual intensity)
      const lampId = this.getLampId(lamp);
      if (lampId) {
        const entry = this.relightingLamps.get(lampId);
        if (entry) {
          const progress = Math.min(1, (now - entry.startTime) / entry.duration);
          litLamps.push({ lamp, dist, intensity: LIGHTING.LAMP_POOL_INTENSITY * progress });
        }
      }
    }
    litLamps.sort((a, b) => a.dist - b.dist);

    // Assign pool lights to nearest lamps, park the rest off-screen
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = this.pool[i];
      if (i < litLamps.length) {
        const pos = litLamps[i].lamp.getPosition();
        light.position.set(pos.x, litLamps[i].lamp.lampY, pos.z);
        light.intensity = litLamps[i].intensity;
      } else {
        light.position.set(0, -100, 0);
        light.intensity = 0;
      }
    }
  }

  private getLampId(lamp: LampObject): string | null {
    for (const [id, l] of this.lamps) {
      if (l === lamp) return id;
    }
    return null;
  }

  getLamp(id: string): LampObject | undefined {
    return this.lamps.get(id);
  }

  dispose(): void {
    for (const light of this.pool) {
      this.scene.remove(light);
    }
    this.pool.length = 0;
    for (const [, lamp] of this.lamps) {
      this.scene.remove(lamp.getGroup());
      lamp.dispose();
    }
    this.lamps.clear();
    this.lampList.length = 0;
  }
}
