import * as THREE from "three";
import { CharacterRenderer } from "./CharacterRenderer.js";

type WeaponType = "katana" | "lance";

const WEAPON_CONFIGS: Record<WeaponType, {
  geometry: THREE.BufferGeometry;
  color: number;
  offset: THREE.Vector3;
  rotation: THREE.Euler;
}> = {
  katana: {
    geometry: new THREE.BoxGeometry(0.05, 0.05, 0.9),
    color: 0xcccccc,
    offset: new THREE.Vector3(0.5, 1.2, -0.4),
    rotation: new THREE.Euler(0.3, 0, 0),
  },
  lance: {
    geometry: new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6),
    color: 0x8b4513,
    offset: new THREE.Vector3(0.5, 1.4, -0.5),
    rotation: new THREE.Euler(0.5, 0, 0),
  },
};

export class WeaponRenderer {
  private characterRenderer: CharacterRenderer;
  private weapons = new Map<string, THREE.Mesh>();

  constructor(characterRenderer: CharacterRenderer) {
    this.characterRenderer = characterRenderer;
  }

  updateWeapon(sessionId: string, weaponType: WeaponType): void {
    const group = this.characterRenderer.getGroup(sessionId);
    if (!group) return;

    // Remove existing weapon
    const existing = this.weapons.get(sessionId);
    if (existing) {
      group.remove(existing);
      existing.geometry.dispose();
      if (existing.material instanceof THREE.Material) {
        existing.material.dispose();
      }
      this.weapons.delete(sessionId);
    }

    // Create new weapon
    const config = WEAPON_CONFIGS[weaponType];
    if (!config) return;

    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: weaponType === "katana" ? 0.8 : 0.1,
      roughness: weaponType === "katana" ? 0.2 : 0.8,
    });

    const mesh = new THREE.Mesh(config.geometry.clone(), material);
    mesh.position.copy(config.offset);
    mesh.rotation.copy(config.rotation);
    mesh.castShadow = true;

    group.add(mesh);
    this.weapons.set(sessionId, mesh);
  }

  removeWeapon(sessionId: string): void {
    const group = this.characterRenderer.getGroup(sessionId);
    const weapon = this.weapons.get(sessionId);
    if (group && weapon) {
      group.remove(weapon);
      weapon.geometry.dispose();
      if (weapon.material instanceof THREE.Material) {
        weapon.material.dispose();
      }
    }
    this.weapons.delete(sessionId);
  }
}
