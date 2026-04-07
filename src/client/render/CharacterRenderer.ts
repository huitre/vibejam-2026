import * as THREE from "three";

const CHARACTER_COLORS: Record<string, number> = {
  ninja: 0x8800cc,
  samurai: 0xcc2222,
  shogun: 0xffcc00,
};

interface CharacterEntity {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetRot: number;
  currentRot: number;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private entities = new Map<string, CharacterEntity>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addPlayer(sessionId: string, role: string, x: number, y: number, z: number): void {
    if (this.entities.has(sessionId)) return;

    const color = CHARACTER_COLORS[role] ?? 0xcccccc;
    const material = new THREE.MeshStandardMaterial({ color });

    const group = new THREE.Group();

    // Body: cylinder
    const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 12);
    const body = new THREE.Mesh(bodyGeom, material);
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head: sphere
    const headGeom = new THREE.SphereGeometry(0.25, 8, 8);
    const head = new THREE.Mesh(headGeom, material);
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.entities.set(sessionId, {
      group,
      targetPos: new THREE.Vector3(x, y, z),
      targetRot: 0,
      currentRot: 0,
    });
  }

  removePlayer(sessionId: string): void {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

    this.scene.remove(entity.group);
    entity.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    this.entities.delete(sessionId);
  }

  updatePlayer(sessionId: string, x: number, y: number, z: number, rotation: number): void {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

    entity.targetPos.set(x, y, z);
    entity.targetRot = rotation;
  }

  interpolateAll(lerpFactor: number = 0.15): void {
    for (const entity of this.entities.values()) {
      entity.group.position.lerp(entity.targetPos, lerpFactor);

      // Smoothly interpolate rotation (handle wrapping)
      let rotDiff = entity.targetRot - entity.currentRot;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      entity.currentRot += rotDiff * lerpFactor;
      entity.group.rotation.y = entity.currentRot;
    }
  }

  getEntity(sessionId: string): CharacterEntity | undefined {
    return this.entities.get(sessionId);
  }

  getGroup(sessionId: string): THREE.Group | undefined {
    return this.entities.get(sessionId)?.group;
  }
}
