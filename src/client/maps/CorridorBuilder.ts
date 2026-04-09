import * as THREE from "three";
import { toonGradientMap } from "../render/ToonGradient.js";

const CORRIDOR_WIDTH = 4;
const CORRIDOR_HEIGHT = 3.5;
const COLUMN_SPACING = 4;

interface CorridorDef {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
}

const CORRIDORS: CorridorDef[] = [
  // West corridors (vertical)
  { startX: 5, startZ: 18, endX: 5, endZ: 28 },
  { startX: 5, startZ: 62, endX: 5, endZ: 75 },
  // East corridors (vertical)
  { startX: 75, startZ: 18, endX: 75, endZ: 28 },
  { startX: 75, startZ: 62, endX: 75, endZ: 75 },
  // South connecting (horizontal)
  { startX: 25, startZ: 18, endX: 55, endZ: 18 },
  // North connecting segments
  { startX: 18, startZ: 75, endX: 15, endZ: 75 },
  { startX: 65, startZ: 75, endX: 62, endZ: 75 },
];

export class CorridorBuilder {
  static build(scene: THREE.Scene): void {
    const floorMat = new THREE.MeshToonMaterial({
      color: 0x4a3728,
      gradientMap: toonGradientMap,
    });

    const roofMat = new THREE.MeshToonMaterial({
      color: 0x4a3728,
      gradientMap: toonGradientMap,
    });

    const columnMat = new THREE.MeshToonMaterial({
      color: 0x888888,
      gradientMap: toonGradientMap,
    });

    for (const corridor of CORRIDORS) {
      CorridorBuilder.createCorridor(scene, corridor, floorMat, roofMat, columnMat);
    }
  }

  private static createCorridor(
    scene: THREE.Scene,
    def: CorridorDef,
    floorMat: THREE.MeshToonMaterial,
    roofMat: THREE.MeshToonMaterial,
    columnMat: THREE.MeshToonMaterial,
  ): void {
    const dx = def.endX - def.startX;
    const dz = def.endZ - def.startZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    const isHorizontal = Math.abs(dx) > Math.abs(dz);

    const centerX = (def.startX + def.endX) / 2;
    const centerZ = (def.startZ + def.endZ) / 2;

    const floorW = isHorizontal ? length : CORRIDOR_WIDTH;
    const floorD = isHorizontal ? CORRIDOR_WIDTH : length;

    // Floor
    const floorGeom = new THREE.BoxGeometry(floorW, 0.1, floorD);
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(centerX, 0.05, centerZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // Roof
    const roofGeom = new THREE.BoxGeometry(floorW, 0.1, floorD);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(centerX, CORRIDOR_HEIGHT, centerZ);
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);

    // Columns along the corridor
    const numColumns = Math.max(2, Math.floor(length / COLUMN_SPACING) + 1);
    const columnGeom = new THREE.CylinderGeometry(0.15, 0.15, CORRIDOR_HEIGHT, 6);

    for (let i = 0; i < numColumns; i++) {
      const t = numColumns === 1 ? 0.5 : i / (numColumns - 1);
      const colX = def.startX + dx * t;
      const colZ = def.startZ + dz * t;

      // Two columns on each side of the corridor
      const perpX = isHorizontal ? 0 : CORRIDOR_WIDTH / 2;
      const perpZ = isHorizontal ? CORRIDOR_WIDTH / 2 : 0;

      const col1 = new THREE.Mesh(columnGeom, columnMat);
      col1.position.set(colX - perpX, CORRIDOR_HEIGHT / 2, colZ - perpZ);
      col1.castShadow = true;
      col1.receiveShadow = true;
      scene.add(col1);

      const col2 = new THREE.Mesh(columnGeom, columnMat);
      col2.position.set(colX + perpX, CORRIDOR_HEIGHT / 2, colZ + perpZ);
      col2.castShadow = true;
      col2.receiveShadow = true;
      scene.add(col2);
    }
  }
}
