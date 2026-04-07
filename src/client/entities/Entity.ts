import * as THREE from "three";

export class Entity {
  protected group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setRotationY(rot: number): void {
    this.group.rotation.y = rot;
  }

  getRotationY(): number {
    return this.group.rotation.y;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}
