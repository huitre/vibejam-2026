import * as THREE from "three";

interface SmokeCloud {
  mesh: THREE.Mesh;
  targetRadius: number;
  lifetime: number;
  maxLifetime: number;
}

export class SmokeBombVisual {
  private scene: THREE.Scene;
  private clouds: SmokeCloud[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createCloud(x: number, z: number, radius: number, durationMs: number): void {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.5, z);
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);

    this.clouds.push({
      mesh,
      targetRadius: radius,
      lifetime: 0,
      maxLifetime: durationMs,
    });
  }

  update(deltaMs: number): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i];
      cloud.lifetime += deltaMs;

      // Expand quickly in first 500ms
      const expandT = Math.min(1, cloud.lifetime / 500);
      const scale = cloud.targetRadius * expandT;
      cloud.mesh.scale.setScalar(scale);

      // Fade out in last 2 seconds
      const fadeStart = cloud.maxLifetime - 2000;
      if (cloud.lifetime > fadeStart) {
        const fadeT = (cloud.lifetime - fadeStart) / 2000;
        (cloud.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - fadeT);
      }

      // Slight rotation for effect
      cloud.mesh.rotation.y += deltaMs * 0.0003;

      if (cloud.lifetime >= cloud.maxLifetime) {
        this.scene.remove(cloud.mesh);
        cloud.mesh.geometry.dispose();
        (cloud.mesh.material as THREE.Material).dispose();
        this.clouds.splice(i, 1);
      }
    }
  }
}
