import * as THREE from "three";
import { MAP } from "../../shared/constants.js";

const { WIDTH, DEPTH, WALL_HEIGHT, WALL_THICKNESS } = MAP;

export class WallBuilder {
  static build(scene: THREE.Scene): void {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.8,
      metalness: 0.1,
    });

    const spiritWallMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.8,
      metalness: 0.1,
    });

    // West wall
    WallBuilder.createWall(
      scene, wallMat,
      WALL_THICKNESS, WALL_HEIGHT, DEPTH,
      0, WALL_HEIGHT / 2, DEPTH / 2,
    );

    // East wall
    WallBuilder.createWall(
      scene, wallMat,
      WALL_THICKNESS, WALL_HEIGHT, DEPTH,
      WIDTH, WALL_HEIGHT / 2, DEPTH / 2,
    );

    // North wall
    WallBuilder.createWall(
      scene, wallMat,
      WIDTH, WALL_HEIGHT, WALL_THICKNESS,
      WIDTH / 2, WALL_HEIGHT / 2, DEPTH,
    );

    // South wall: two segments flanking the gate opening (gap at x=36 to x=44)
    // Left segment: from x=0 to x=36
    WallBuilder.createWall(
      scene, wallMat,
      36, WALL_HEIGHT, WALL_THICKNESS,
      18, WALL_HEIGHT / 2, 0,
    );

    // Right segment: from x=44 to x=WIDTH
    const rightWidth = WIDTH - 44;
    WallBuilder.createWall(
      scene, wallMat,
      rightWidth, WALL_HEIGHT, WALL_THICKNESS,
      44 + rightWidth / 2, WALL_HEIGHT / 2, 0,
    );

    // Spirit wall: freestanding barrier
    WallBuilder.createWall(
      scene, spiritWallMat,
      12, 4, 0.5,
      40, 2, 6.5,
    );
  }

  private static createWall(
    scene: THREE.Scene,
    material: THREE.MeshStandardMaterial,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
