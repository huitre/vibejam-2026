import * as THREE from "three";
import { toonGradientMap } from "../render/ToonGradient.js";
import { LevelLoader } from "./LevelLoader.js";

export class MapBuilder {
  static async build(scene: THREE.Scene): Promise<void> {
    // Load level from JSON (returns scaled dimensions)
    const loader = new LevelLoader();
    const dims = await loader.load(scene, "/map_pieces/level_1.json");

    // Ground plane sized to match the level
    const groundGeom = new THREE.PlaneGeometry(dims.width, dims.depth);
    const groundMat = new THREE.MeshToonMaterial({
      color: 0x2a4a2a,
      gradientMap: toonGradientMap,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(dims.width / 2, 0, dims.depth / 2);
    ground.receiveShadow = true;
    scene.add(ground);
  }
}
