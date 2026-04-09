import * as THREE from "three";
import { toonGradientMap } from "../render/ToonGradient.js";

export class LampObject {
  private group: THREE.Group;
  private flame: THREE.Mesh;
  private isLit: boolean;
  readonly lampY: number;

  constructor(x: number, y: number, z: number, lit: boolean, lanternModel: THREE.Group | null) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.isLit = lit;
    this.lampY = y;

    if (lanternModel) {
      const clone = lanternModel.clone(true);
      // Scale model to match lamp height
      const box = new THREE.Box3().setFromObject(clone);
      const modelHeight = box.max.y - box.min.y;
      const scale = y / modelHeight;
      clone.scale.setScalar(scale);
      // Offset so bottom sits at y=0
      const scaledBox = new THREE.Box3().setFromObject(clone);
      clone.position.y = -scaledBox.min.y;
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.group.add(clone);
      // No flame sphere needed — the model itself is the visual
      this.flame = new THREE.Mesh();
      this.flame.visible = false;
    } else {
      // Fallback: post
      const postGeom = new THREE.CylinderGeometry(0.08, 0.08, y, 6);
      const postMat = new THREE.MeshToonMaterial({ color: 0x8b4513, gradientMap: toonGradientMap });
      const post = new THREE.Mesh(postGeom, postMat);
      post.position.y = y / 2;
      post.receiveShadow = true;
      this.group.add(post);

      // Flame glow sphere — only for fallback (no model)
      const flameGeom = new THREE.SphereGeometry(0.15, 6, 6);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xfff3ba });
      this.flame = new THREE.Mesh(flameGeom, flameMat);
      this.flame.position.y = y;
      this.flame.visible = lit;
      this.group.add(this.flame);
    }

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
