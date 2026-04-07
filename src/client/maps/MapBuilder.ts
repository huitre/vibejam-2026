import * as THREE from "three";
import { MAP } from "../../shared/constants.js";
import { WallBuilder } from "./WallBuilder.js";
import { BuildingBuilder } from "./BuildingBuilder.js";
import { CorridorBuilder } from "./CorridorBuilder.js";
import { CourtyardBuilder } from "./CourtyardBuilder.js";
import { GateBuilder } from "./GateBuilder.js";

export class MapBuilder {
  static build(scene: THREE.Scene): void {
    // Ground plane
    const groundGeom = new THREE.PlaneGeometry(MAP.WIDTH, MAP.DEPTH);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a2a,
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP.WIDTH / 2, 0, MAP.DEPTH / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Build all sub-elements
    WallBuilder.build(scene);
    BuildingBuilder.build(scene);
    CorridorBuilder.build(scene);
    CourtyardBuilder.build(scene);
    GateBuilder.build(scene);
  }
}
