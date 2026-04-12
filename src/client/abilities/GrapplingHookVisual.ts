import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "../render/ToonGradient.js";

const SPIN_DURATION = 600;   // ms for 2.5 spins
const SPIN_TURNS = 2.5;
const THROW_DURATION = 400;  // ms for hook to reach wall
const ROPE_SEGMENTS = 24;
const ROPE_RADIUS = 0.025;
const ROPE_COLOR = 0x8b7355;
const HAND_OFFSET_Y = 1.3;

interface HookAnimation {
  casterSessionId: string;
  phase: "spinning" | "throwing" | "attached";
  startTime: number;
  // Positions
  startX: number;
  startZ: number;
  wallX: number;
  wallZ: number;
  wallY: number;
  // Three.js objects
  hookModel: THREE.Object3D;
  ropeMesh: THREE.Mesh | null;
  ropeGeo: THREE.TubeGeometry | null;
}

export class GrapplingHookVisual {
  private scene: THREE.Scene;
  private hookTemplate: THREE.Group | null = null;
  private activeAnim: HookAnimation | null = null;
  private ropeMaterial: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ropeMaterial = new THREE.MeshToonMaterial({
      color: ROPE_COLOR,
      gradientMap: toonGradientMap,
    });
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      const [gltf, diffuse, normal] = await Promise.all([
        new GLTFLoader().loadAsync("/hook.glb"),
        new THREE.TextureLoader().loadAsync("/hook_texture_diffuse.jpg"),
        new THREE.TextureLoader().loadAsync("/hook_texture_normal.jpg"),
      ]);

      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      diffuse.flipY = false;
      normal.flipY = false;

      const model = gltf.scene;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshToonMaterial({
            map: diffuse,
            normalMap: normal,
            gradientMap: toonGradientMap,
          });
          child.castShadow = true;
        }
      });

      // Normalize to ~0.4 units
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(0.4 / maxDim);

      this.hookTemplate = model;
    } catch (e) {
      console.warn("Failed to load hook.glb, using fallback", e);
    }
  }

  launch(casterSessionId: string, startX: number, startZ: number, wallX: number, wallZ: number, wallY: number): void {
    // Clean up any previous animation
    this.cleanup();

    const hookModel = this.createHookModel();
    hookModel.position.set(startX, HAND_OFFSET_Y, startZ);
    this.scene.add(hookModel);

    this.activeAnim = {
      casterSessionId,
      phase: "spinning",
      startTime: performance.now(),
      startX,
      startZ,
      wallX,
      wallZ,
      wallY,
      hookModel,
      ropeMesh: null,
      ropeGeo: null,
    };
  }

  private createHookModel(): THREE.Object3D {
    if (this.hookTemplate) {
      return this.hookTemplate.clone(true);
    }
    // Fallback: small box
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.4);
    const mat = new THREE.MeshToonMaterial({ color: 0x666666, gradientMap: toonGradientMap });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  update(deltaMs: number, casterEntity: { position: THREE.Vector3 } | null): void {
    if (!this.activeAnim) return;

    const anim = this.activeAnim;
    const now = performance.now();
    const elapsed = now - anim.startTime;

    // Player hand position (follows caster entity if available)
    const handX = casterEntity ? casterEntity.position.x : anim.startX;
    const handY = casterEntity ? casterEntity.position.y + HAND_OFFSET_Y : HAND_OFFSET_Y;
    const handZ = casterEntity ? casterEntity.position.z : anim.startZ;

    if (anim.phase === "spinning") {
      // Hook spins above the player's hand
      const t = Math.min(elapsed / SPIN_DURATION, 1);
      const angle = t * SPIN_TURNS * Math.PI * 2;

      // Orbit radius starts small and grows
      const radius = 0.3 + t * 0.3;
      anim.hookModel.position.set(
        handX + Math.sin(angle) * radius,
        handY + 0.5 + t * 0.3,
        handZ + Math.cos(angle) * radius,
      );
      anim.hookModel.rotation.y = angle;

      // Build rope from hand to hook during spin
      this.updateRope(handX, handY, handZ, anim.hookModel.position.x, anim.hookModel.position.y, anim.hookModel.position.z, 0);

      if (t >= 1) {
        anim.phase = "throwing";
        anim.startTime = now;
      }
    } else if (anim.phase === "throwing") {
      const t = Math.min(elapsed / THROW_DURATION, 1);
      // Eased throw trajectory
      const eased = t * (2 - t); // easeOutQuad

      // Start from above hand, end at wall top
      const throwStartX = handX;
      const throwStartY = handY + 0.8;
      const throwStartZ = handZ;

      const hookX = throwStartX + (anim.wallX - throwStartX) * eased;
      const hookZ = throwStartZ + (anim.wallZ - throwStartZ) * eased;
      // Parabolic arc
      const hookY = throwStartY + (anim.wallY - throwStartY) * eased + Math.sin(eased * Math.PI) * 2;

      anim.hookModel.position.set(hookX, hookY, hookZ);
      // Hook rotates during flight
      anim.hookModel.rotation.y += deltaMs * 0.01;
      anim.hookModel.rotation.x = -eased * Math.PI * 0.3;

      // Rope with sag
      const sag = (1 - eased) * 1.5;
      this.updateRope(handX, handY, handZ, hookX, hookY, hookZ, sag);

      if (t >= 1) {
        anim.phase = "attached";
        anim.startTime = now;
        // Lock hook at wall top
        anim.hookModel.position.set(anim.wallX, anim.wallY, anim.wallZ);
        anim.hookModel.rotation.set(0, 0, 0);
      }
    } else if (anim.phase === "attached") {
      // Hook stays at wall top, rope follows player as they climb
      this.updateRope(handX, handY, handZ, anim.wallX, anim.wallY, anim.wallZ, 0.2);

      // Auto-cleanup after climb duration (1.5s + margin)
      if (elapsed > 2000) {
        this.cleanup();
      }
    }
  }

  private updateRope(
    fromX: number, fromY: number, fromZ: number,
    toX: number, toY: number, toZ: number,
    sag: number,
  ): void {
    if (!this.activeAnim) return;

    // Remove old rope mesh
    if (this.activeAnim.ropeMesh) {
      this.scene.remove(this.activeAnim.ropeMesh);
      this.activeAnim.ropeGeo?.dispose();
    }

    // Build catenary curve
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= ROPE_SEGMENTS; i++) {
      const t = i / ROPE_SEGMENTS;
      const x = fromX + (toX - fromX) * t;
      const y = fromY + (toY - fromY) * t - Math.sin(t * Math.PI) * sag;
      const z = fromZ + (toZ - fromZ) * t;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points, false);
    const tubeGeo = new THREE.TubeGeometry(curve, ROPE_SEGMENTS, ROPE_RADIUS, 4, false);
    const ropeMesh = new THREE.Mesh(tubeGeo, this.ropeMaterial);

    this.scene.add(ropeMesh);
    this.activeAnim.ropeMesh = ropeMesh;
    this.activeAnim.ropeGeo = tubeGeo;
  }

  cleanup(): void {
    if (!this.activeAnim) return;

    this.scene.remove(this.activeAnim.hookModel);
    this.activeAnim.hookModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });

    if (this.activeAnim.ropeMesh) {
      this.scene.remove(this.activeAnim.ropeMesh);
      this.activeAnim.ropeGeo?.dispose();
    }

    this.activeAnim = null;
  }

  isActive(): boolean {
    return this.activeAnim !== null;
  }

  getActiveCaster(): string | null {
    return this.activeAnim?.casterSessionId ?? null;
  }
}
