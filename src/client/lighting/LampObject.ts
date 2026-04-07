import * as THREE from "three";

export class LampObject {
  private group: THREE.Group;
  private flame: THREE.Mesh;
  private post: THREE.Mesh;
  private isLit: boolean;
  readonly lampY: number;

  constructor(x: number, y: number, z: number, lit: boolean) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.isLit = lit;
    this.lampY = y;

    // Post
    const postGeom = new THREE.CylinderGeometry(0.08, 0.08, y, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    this.post = new THREE.Mesh(postGeom, postMat);
    this.post.position.y = y / 2;
    this.post.receiveShadow = true;
    this.group.add(this.post);

    // Flame — always visible, zero lighting cost
    const flameGeom = new THREE.SphereGeometry(0.15, 6, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    this.flame = new THREE.Mesh(flameGeom, flameMat);
    this.flame.position.y = y;
    this.flame.visible = lit;
    this.group.add(this.flame);

    // No PointLight here — managed by LightingManager pool
  }

  setLit(lit: boolean): void {
    this.isLit = lit;
    this.flame.visible = lit;
  }

  getLit(): boolean {
    return this.isLit;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
