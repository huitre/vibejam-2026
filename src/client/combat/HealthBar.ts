import * as THREE from "three";

export class HealthBar {
  private bars = new Map<string, { bg: THREE.Mesh; fill: THREE.Mesh }>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addBar(sessionId: string, group: THREE.Group): void {
    const bgGeo = new THREE.PlaneGeometry(1.2, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.y = 2.5;
    bg.renderOrder = 999;

    const fillGeo = new THREE.PlaneGeometry(1.16, 0.08);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x22cc22, side: THREE.DoubleSide, depthTest: false });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.y = 2.5;
    fill.position.z = 0.001;
    fill.renderOrder = 1000;

    group.add(bg);
    group.add(fill);
    this.bars.set(sessionId, { bg, fill });
  }

  updateBar(sessionId: string, hp: number, maxHp: number): void {
    const bar = this.bars.get(sessionId);
    if (!bar) return;

    const pct = Math.max(0, hp / maxHp);
    bar.fill.scale.x = pct;
    bar.fill.position.x = -(1 - pct) * 0.58;

    const r = Math.round(255 * (1 - pct));
    const g = Math.round(255 * pct);
    (bar.fill.material as THREE.MeshBasicMaterial).color.setRGB(r / 255, g / 255, 0.1);
  }

  removeBar(sessionId: string): void {
    this.bars.delete(sessionId);
  }

  // Make health bars face camera each frame
  updateBillboards(camera: THREE.Camera): void {
    this.bars.forEach(({ bg, fill }) => {
      bg.quaternion.copy(camera.quaternion);
      fill.quaternion.copy(camera.quaternion);
    });
  }
}
