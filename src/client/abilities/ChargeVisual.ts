import * as THREE from "three";

interface TrailSegment {
  mesh: THREE.Mesh;
  lifetime: number;
}

export class ChargeVisual {
  private scene: THREE.Scene;
  private trails: TrailSegment[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  showCharge(fromX: number, fromZ: number, toX: number, toZ: number): void {
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const x = fromX + (toX - fromX) * t;
      const z = fromZ + (toZ - fromZ) * t;

      const geo = new THREE.PlaneGeometry(0.8, 1.8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.5 * (1 - t),
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.9, z);
      mesh.rotation.y = Math.atan2(toX - fromX, toZ - fromZ);
      this.scene.add(mesh);

      this.trails.push({ mesh, lifetime: 0 });
    }
  }

  update(deltaMs: number): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.lifetime += deltaMs;
      const t = trail.lifetime / 500;
      (trail.mesh.material as THREE.MeshBasicMaterial).opacity *= 0.95;

      if (trail.lifetime > 500) {
        this.scene.remove(trail.mesh);
        trail.mesh.geometry.dispose();
        (trail.mesh.material as THREE.Material).dispose();
        this.trails.splice(i, 1);
      }
    }
  }
}
