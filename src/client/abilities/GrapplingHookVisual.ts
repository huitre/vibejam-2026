import * as THREE from "three";

export class GrapplingHookVisual {
  private scene: THREE.Scene;
  private line: THREE.Line | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  show(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number): void {
    this.hide();
    const points = [
      new THREE.Vector3(fromX, fromY, fromZ),
      new THREE.Vector3(toX, toY, toZ),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x888866, linewidth: 2 });
    this.line = new THREE.Line(geo, mat);
    this.scene.add(this.line);
  }

  updateFrom(x: number, y: number, z: number): void {
    if (!this.line) return;
    const positions = this.line.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, x, y, z);
    positions.needsUpdate = true;
  }

  hide(): void {
    if (this.line) {
      this.scene.remove(this.line);
      this.line.geometry.dispose();
      (this.line.material as THREE.Material).dispose();
      this.line = null;
    }
  }
}
