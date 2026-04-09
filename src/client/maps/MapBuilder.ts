import * as THREE from "three";
import { MAP } from "../../shared/constants.js";
import { toonGradientMap } from "../render/ToonGradient.js";
import { CourtyardBuilder } from "./CourtyardBuilder.js";

export class MapBuilder {
  static async build(scene: THREE.Scene): Promise<void> {
    await CourtyardBuilder.loadModels();

    // Ground plane
    const groundGeom = new THREE.PlaneGeometry(MAP.WIDTH, MAP.DEPTH);
    const groundMat = new THREE.MeshToonMaterial({
      color: 0x2a4a2a,
      gradientMap: toonGradientMap,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP.WIDTH / 2, 0, MAP.DEPTH / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Trees and basin
    CourtyardBuilder.build(scene);
  }
}
