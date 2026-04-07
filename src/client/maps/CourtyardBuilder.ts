import * as THREE from "three";

interface TreeDef {
  x: number;
  z: number;
}

const TREES: TreeDef[] = [
  { x: 30, z: 40 },
  { x: 50, z: 40 },
  { x: 35, z: 60 },
  { x: 45, z: 60 },
];

export class CourtyardBuilder {
  static build(scene: THREE.Scene): void {
    // Ground overlay for the courtyard area
    const courtyardWidth = 62 - 18;
    const courtyardDepth = 75 - 18;
    const groundGeom = new THREE.PlaneGeometry(courtyardWidth, courtyardDepth);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(
      (18 + 62) / 2,
      0.01, // slightly above main ground
      (18 + 75) / 2,
    );
    ground.receiveShadow = true;
    scene.add(ground);

    // Trees
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5a3a1a,
      roughness: 0.9,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x1a4a1a,
      roughness: 0.8,
    });

    for (const tree of TREES) {
      CourtyardBuilder.createTree(scene, tree.x, tree.z, trunkMat, canopyMat);
    }

    // Stone paths connecting buildings (horizontal and vertical strips)
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Horizontal path across the courtyard center
    const hPathGeom = new THREE.BoxGeometry(courtyardWidth, 0.02, 2);
    const hPath = new THREE.Mesh(hPathGeom, pathMat);
    hPath.position.set((18 + 62) / 2, 0.02, 50);
    hPath.receiveShadow = true;
    scene.add(hPath);

    // Vertical path down the middle
    const vPathGeom = new THREE.BoxGeometry(2, 0.02, courtyardDepth);
    const vPath = new THREE.Mesh(vPathGeom, pathMat);
    vPath.position.set(40, 0.02, (18 + 75) / 2);
    vPath.receiveShadow = true;
    scene.add(vPath);
  }

  private static createTree(
    scene: THREE.Scene,
    x: number,
    z: number,
    trunkMat: THREE.MeshStandardMaterial,
    canopyMat: THREE.MeshStandardMaterial,
  ): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Canopy
    const canopyGeom = new THREE.IcosahedronGeometry(2.5, 1);
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.y = 5;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);

    scene.add(group);
  }
}
