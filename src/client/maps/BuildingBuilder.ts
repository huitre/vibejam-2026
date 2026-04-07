import * as THREE from "three";
import { MAP } from "../../shared/constants.js";

const { BUILDING_HEIGHT, ROOF_OVERHANG } = MAP;

interface BuildingDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  roofColor?: number;
}

const BUILDINGS: BuildingDef[] = [
  // South room west
  { x: 5, z: 5, w: 20, d: 13 },
  // South room east
  { x: 55, z: 5, w: 20, d: 13 },
  // West wing
  { x: 3, z: 28, w: 15, d: 34 },
  // East wing
  { x: 62, z: 28, w: 15, d: 34 },
  // Main hall (taller)
  { x: 15, z: 75, w: 50, d: 20, h: 6 },
  // Back rooms
  { x: 20, z: 95, w: 40, d: 5 },
  // Ear room west
  { x: 5, z: 78, w: 10, d: 12 },
  // Ear room east
  { x: 65, z: 78, w: 10, d: 12 },
];

export class BuildingBuilder {
  static build(scene: THREE.Scene): void {
    for (const def of BUILDINGS) {
      BuildingBuilder.createBuilding(
        scene,
        def.x,
        def.z,
        def.w,
        def.d,
        def.h ?? BUILDING_HEIGHT,
        def.roofColor ?? 0x444444,
      );
    }
  }

  private static createBuilding(
    scene: THREE.Scene,
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    roofColor: number,
  ): void {
    // Walls
    const wallGeom = new THREE.BoxGeometry(w, h, d);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3a2820,
      roughness: 0.9,
      metalness: 0.0,
    });
    const walls = new THREE.Mesh(wallGeom, wallMat);
    walls.position.set(x + w / 2, h / 2, z + d / 2);
    walls.castShadow = true;
    walls.receiveShadow = true;
    scene.add(walls);

    // Roof
    const roofGeom = new THREE.BoxGeometry(
      w + ROOF_OVERHANG * 2,
      0.3,
      d + ROOF_OVERHANG * 2,
    );
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.7,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(x + w / 2, h + 0.15, z + d / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);
  }
}
