import * as THREE from "three";

const COLORS: Record<string, number> = {
  water_bomb: 0x4488ff,
  smoke_bomb: 0x888888,
};

export class BombAimIndicator {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private ring: THREE.Mesh;
  private disc: THREE.Mesh;
  private visible = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;

    // Outer ring
    const ringGeom = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeom, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    // Inner filled disc
    const discGeom = new THREE.CircleGeometry(0.8, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    this.disc = new THREE.Mesh(discGeom, discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.05;
    this.group.add(this.disc);

    this.scene.add(this.group);
  }

  show(kind: string): void {
    const color = COLORS[kind] ?? 0xffffff;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.disc.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.group.visible = true;
    this.visible = true;
  }

  updatePosition(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  hide(): void {
    this.group.visible = false;
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.disc.geometry.dispose();
    (this.disc.material as THREE.Material).dispose();
    this.scene.remove(this.group);
  }
}
