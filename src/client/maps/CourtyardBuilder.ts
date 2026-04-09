import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "../render/ToonGradient.js";

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

const TREE_HEIGHT = 7;
const BASIN_SCALE = 1.5;

export class CourtyardBuilder {
  private static treeModel: THREE.Group | null = null;
  private static basinModel: THREE.Group | null = null;

  static async loadModels(): Promise<void> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const [treeResult, basinResult] = await Promise.allSettled([
      CourtyardBuilder.loadTree(loader, texLoader),
      CourtyardBuilder.loadBasin(loader, texLoader),
    ]);

    if (treeResult.status === "rejected") {
      console.warn("Failed to load tree model, will use fallback", treeResult.reason);
    }
    if (basinResult.status === "rejected") {
      console.warn("Failed to load basin model", basinResult.reason);
    }
  }

  private static async loadTree(loader: GLTFLoader, texLoader: THREE.TextureLoader): Promise<void> {
    const [gltf, diffuse, normal] = await Promise.all([
      loader.loadAsync("/tree.glb"),
      texLoader.loadAsync("/tree_texture_diffuse.jpg"),
      texLoader.loadAsync("/tree_texture_normal.jpg"),
    ]);

    diffuse.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.LinearSRGBColorSpace;
    diffuse.flipY = false;
    normal.flipY = false;

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshToonMaterial({
          map: diffuse,
          normalMap: normal,
          gradientMap: toonGradientMap,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    CourtyardBuilder.treeModel = gltf.scene;
  }

  private static async loadBasin(loader: GLTFLoader, texLoader: THREE.TextureLoader): Promise<void> {
    const [gltf, diffuse, normal] = await Promise.all([
      loader.loadAsync("/basin.glb"),
      texLoader.loadAsync("/basin_texture_diffuse.jpg"),
      texLoader.loadAsync("/basin_texture_normal.jpg"),
    ]);

    diffuse.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.LinearSRGBColorSpace;
    diffuse.flipY = false;
    normal.flipY = false;

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshToonMaterial({
          map: diffuse,
          normalMap: normal,
          gradientMap: toonGradientMap,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    CourtyardBuilder.basinModel = gltf.scene;
  }

  static build(scene: THREE.Scene): void {
    // Ground overlay for the courtyard area
    const courtyardWidth = 62 - 18;
    const courtyardDepth = 75 - 18;
    const groundGeom = new THREE.PlaneGeometry(courtyardWidth, courtyardDepth);
    const groundMat = new THREE.MeshToonMaterial({
      color: 0x8b7355,
      gradientMap: toonGradientMap,
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
    for (const tree of TREES) {
      CourtyardBuilder.createTree(scene, tree.x, tree.z);
    }

    // Basin — flush against the spirit wall, interior side (wall face at z=6.75)
    CourtyardBuilder.createBasin(scene, 40, 6.75);

    // Stone paths connecting buildings (horizontal and vertical strips)
    const pathMat = new THREE.MeshToonMaterial({
      color: 0x999999,
      gradientMap: toonGradientMap,
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

  private static createTree(scene: THREE.Scene, x: number, z: number): void {
    if (CourtyardBuilder.treeModel) {
      const clone = CourtyardBuilder.treeModel.clone(true);
      // Scale to target height
      const box = new THREE.Box3().setFromObject(clone);
      const height = box.max.y - box.min.y;
      const scale = TREE_HEIGHT / height;
      clone.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(clone);
      clone.position.set(x, -scaledBox.min.y, z);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(clone);
    } else {
      // Fallback: procedural tree
      const trunkMat = new THREE.MeshToonMaterial({ color: 0x5a3a1a, gradientMap: toonGradientMap });
      const canopyMat = new THREE.MeshToonMaterial({ color: 0x1a4a1a, gradientMap: toonGradientMap });

      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const trunkGeom = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      group.add(trunk);

      const canopyGeom = new THREE.IcosahedronGeometry(2.5, 1);
      const canopy = new THREE.Mesh(canopyGeom, canopyMat);
      canopy.position.y = 5;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      group.add(canopy);

      scene.add(group);
    }
  }

  private static createBasin(scene: THREE.Scene, x: number, wallZ: number): void {
    if (!CourtyardBuilder.basinModel) return;

    const clone = CourtyardBuilder.basinModel.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const height = box.max.y - box.min.y;
    const scale = BASIN_SCALE / height;
    clone.scale.setScalar(scale);
    // Position so the back edge of the basin touches the wall
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const depth = scaledBox.max.z - scaledBox.min.z;
    clone.position.set(x, -scaledBox.min.y, wallZ + depth / 2);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(clone);
  }
}
