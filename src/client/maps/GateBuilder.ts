import * as THREE from "three";
import { MAP } from "../../shared/constants.js";
import { toonGradientMap } from "../render/ToonGradient.js";

export class GateBuilder {
  static build(scene: THREE.Scene): void {
    const woodMat = new THREE.MeshToonMaterial({
      color: 0x3a2820,
      gradientMap: toonGradientMap,
    });

    const pillarHeight = MAP.WALL_HEIGHT + 1;
    const pillarGeom = new THREE.BoxGeometry(2, pillarHeight, 2);

    // Left pillar
    const leftPillar = new THREE.Mesh(pillarGeom, woodMat);
    leftPillar.position.set(35, pillarHeight / 2, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    scene.add(leftPillar);

    // Right pillar
    const rightPillar = new THREE.Mesh(pillarGeom, woodMat);
    rightPillar.position.set(45, pillarHeight / 2, 0);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    scene.add(rightPillar);

    // Lintel beam across the top
    const lintelGeom = new THREE.BoxGeometry(14, 1.5, 2);
    const lintel = new THREE.Mesh(lintelGeom, woodMat);
    lintel.position.set(40, pillarHeight - 0.5, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    scene.add(lintel);
  }
}
