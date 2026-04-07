import * as THREE from "three";
import { LampObject } from "./LampObject.js";
import { LAMP } from "../../shared/constants.js";

/**
 * Light pooling: a fixed pool of N PointLights is moved to the nearest lit lamps each frame.
 * Three.js compiles shaders with NUM_POINT_LIGHTS = POOL_SIZE (constant),
 * so the per-pixel cost stays fixed regardless of total lamp count.
 */
const POOL_SIZE = 8;

export class LightingManager {
  private scene: THREE.Scene;
  private lamps = new Map<string, LampObject>();
  private lampList: LampObject[] = [];
  private pool: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create fixed pool of PointLights once
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xff8833, 3, LAMP.LIGHT_RADIUS);
      light.castShadow = false;
      light.position.set(0, -100, 0); // parked off-screen
      this.scene.add(light);
      this.pool.push(light);
    }
  }

  addLamp(id: string, x: number, y: number, z: number, lit: boolean): void {
    if (this.lamps.has(id)) return;
    const lamp = new LampObject(x, y, z, lit);
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

  /** Move pool lights to the nearest lit lamps around the player */
  updateShadowBudget(playerPos: THREE.Vector3): void {
    // Sort lit lamps by distance to player
    const litLamps: { lamp: LampObject; dist: number }[] = [];
    for (const lamp of this.lampList) {
      if (!lamp.getLit()) continue;
      const pos = lamp.getPosition();
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      litLamps.push({ lamp, dist: dx * dx + dz * dz });
    }
    litLamps.sort((a, b) => a.dist - b.dist);

    // Assign pool lights to nearest lamps, park the rest off-screen
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = this.pool[i];
      if (i < litLamps.length) {
        const pos = litLamps[i].lamp.getPosition();
        light.position.set(pos.x, litLamps[i].lamp.lampY, pos.z);
        light.intensity = 3;
      } else {
        light.position.set(0, -100, 0);
        light.intensity = 0;
      }
    }
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
