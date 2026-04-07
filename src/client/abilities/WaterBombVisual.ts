import * as THREE from "three";

interface SplashParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
}

export class WaterBombVisual {
  private scene: THREE.Scene;
  private splashes: SplashParticle[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createSplash(x: number, z: number): void {
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.SphereGeometry(0.08, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.5, z);
      this.scene.add(mesh);

      const angle = (i / 12) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.splashes.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 3 + Math.random() * 2, Math.sin(angle) * speed),
        lifetime: 0,
      });
    }
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const p = this.splashes[i];
      p.lifetime += deltaMs;
      p.velocity.y -= 9.8 * dt;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - p.lifetime / 1000);

      if (p.lifetime > 1000) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.splashes.splice(i, 1);
      }
    }
  }
}
