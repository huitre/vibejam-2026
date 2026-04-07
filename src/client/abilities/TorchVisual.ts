import * as THREE from "three";
import { STATS } from "../../shared/constants.js";

export class TorchVisual {
  private scene: THREE.Scene;
  private torches = new Map<string, { light: THREE.PointLight; flame: THREE.Mesh }>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addTorch(sessionId: string, group: THREE.Group): void {
    const light = new THREE.PointLight(0xff6622, 0.8, STATS.samurai.torchRange);
    light.position.set(0.6, 2.0, 0.3);

    const flameGeo = new THREE.SphereGeometry(0.1, 4, 4);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.copy(light.position);

    group.add(light);
    group.add(flame);
    this.torches.set(sessionId, { light, flame });
  }

  removeTorch(sessionId: string): void {
    this.torches.delete(sessionId);
  }

  update(deltaMs: number): void {
    const time = performance.now() / 1000;
    this.torches.forEach(({ light, flame }) => {
      // Flickering
      light.intensity = 0.7 + Math.sin(time * 8) * 0.15 + Math.sin(time * 13) * 0.1;
      flame.scale.setScalar(0.8 + Math.sin(time * 10) * 0.2);
    });
  }
}
