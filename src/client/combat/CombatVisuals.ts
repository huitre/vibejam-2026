import * as THREE from "three";

interface SlashEffect {
  mesh: THREE.Mesh;
  lifetime: number;
  maxLifetime: number;
}

export class CombatVisuals {
  private scene: THREE.Scene;
  private slashes: SlashEffect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  showSlash(x: number, y: number, z: number, rotationY: number, color: number = 0xffffff): void {
    const geo = new THREE.TorusGeometry(1.2, 0.03, 4, 12, Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 1.2, z);
    mesh.rotation.y = rotationY;
    mesh.rotation.x = -Math.PI / 6;
    this.scene.add(mesh);
    this.slashes.push({ mesh, lifetime: 0, maxLifetime: 200 });
  }

  update(deltaMs: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const slash = this.slashes[i];
      slash.lifetime += deltaMs;
      const t = slash.lifetime / slash.maxLifetime;
      (slash.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      slash.mesh.scale.setScalar(1 + t * 0.5);

      if (slash.lifetime >= slash.maxLifetime) {
        this.scene.remove(slash.mesh);
        slash.mesh.geometry.dispose();
        (slash.mesh.material as THREE.Material).dispose();
        this.slashes.splice(i, 1);
      }
    }
  }
}
