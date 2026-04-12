import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CharacterRenderer } from "./CharacterRenderer.js";
import { toonGradientMap } from "./ToonGradient.js";
import { LIGHTING } from "../../shared/constants.js";

type WeaponType = "katana" | "lance" | "torch";

export interface SwingHandle {
  getBaseWorldPos(): THREE.Vector3;
  getTipWorldPos(): THREE.Vector3;
  isActive(): boolean;
}

// Katana OBJ bounding box (from Blender export)
const OBJ_CENTER_X = 9.55;
const OBJ_HILT_Y = 0.33;
const OBJ_TIP_Y = 2.67;
const OBJ_CENTER_Z = -2.86;
const KATANA_SCALE = 0.85;
const KATANA_TIP_Z = -(OBJ_TIP_Y - OBJ_HILT_Y) * KATANA_SCALE; // ≈ -1.99

// Fallback box katana dimensions
const BOX_HALF_LENGTH = 1.0;

// ─── Keyframe types ─────────────────────────────────────────────────────────

type Keyframe = { t: number; pos: number[]; rot: number[] };

// ─── Easing functions ───────────────────────────────────────────────────────

export type EasingName =
  | "linear"
  | "smoothstep"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutCubic"
  | "easeOutBack";

const EASING_FNS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  smoothstep: (t) => t * t * (3 - 2 * t),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

// ─── Swing config (mutable, tweakable from debug panel) ─────────────────────

export const SWING_CONFIG = {
  durationMs: 600,
  easing: "easeOutQuad" as EasingName,
};

function applyEasing(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return EASING_FNS[SWING_CONFIG.easing](x);
}

function lerpKeyframes(
  keyframes: Keyframe[],
  t: number,
): { pos: THREE.Vector3; rot: THREE.Euler } {
  let i = 0;
  for (; i < keyframes.length - 1; i++) {
    if (t <= keyframes[i + 1].t) break;
  }
  const kf0 = keyframes[i];
  const kf1 = keyframes[Math.min(i + 1, keyframes.length - 1)];
  const localT = applyEasing(kf0.t, kf1.t, t);

  return {
    pos: new THREE.Vector3(
      kf0.pos[0] + (kf1.pos[0] - kf0.pos[0]) * localT,
      kf0.pos[1] + (kf1.pos[1] - kf0.pos[1]) * localT,
      kf0.pos[2] + (kf1.pos[2] - kf0.pos[2]) * localT,
    ),
    rot: new THREE.Euler(
      kf0.rot[0] + (kf1.rot[0] - kf0.rot[0]) * localT,
      kf0.rot[1] + (kf1.rot[1] - kf0.rot[1]) * localT,
      kf0.rot[2] + (kf1.rot[2] - kf0.rot[2]) * localT,
    ),
  };
}

// ─── Rest pose: blade held in right hand, edge forward ──────────────────────
// Character faces away from camera (+PI), local +X = screen-right.
// Character: feet at y=0, head top at y≈2.3

export const REST_POS = [0.17, 0.43, -0.77];
export const REST_ROT = [1, 0.34, 1.9];

// ─── Swing A: right → left horizontal slash ─────────────────────────────────

export const SWING_A: Keyframe[] = [
  { t: 0.0, pos: REST_POS, rot: REST_ROT },
  { t: 0.15, pos: [-0.41, 1.01, -0.77], rot: [1.3, 1.16, 1.9] }, // wind-up far right
  { t: 0.8, pos: [0.48, 0.8, -0.41], rot: [2.15, -2.05, -1.54] }, // follow-through far right
  { t: 1.0, pos: REST_POS, rot: REST_ROT },
];

// ─── Swing B: left → right horizontal slash ─────────────────────────────────

export const SWING_B: Keyframe[] = [
  { t: 0.0, pos: REST_POS, rot: REST_ROT },
  { t: 0.15, pos: [0.9, 1.3, -0.1], rot: [0.1, 0.8, -0.2] }, // wind-up far right
  { t: 0.8, pos: [0.48, 0.8, -0.41], rot: [2.15, -2.05, -1.54] }, // follow-through far right
  { t: 0.8, pos: [0.48, 0.8, -0.41], rot: [2.15, -2.05, -1.54] }, // follow-through far right
  { t: 0.8, pos: [0.48, 0.8, -0.41], rot: [2.15, -2.05, -1.54] }, // follow-through far right
  { t: 1.0, pos: REST_POS, rot: REST_ROT },
];

// ─── Weapon entry ───────────────────────────────────────────────────────────

interface WeaponEntry {
  object: THREE.Object3D;
  type: WeaponType;
  baseLocalZ: number;
  tipLocalZ: number;
}

interface TorchExtras {
  flame: THREE.Mesh;
  light: THREE.PointLight;
}

export class WeaponRenderer {
  private characterRenderer: CharacterRenderer;
  private weapons = new Map<string, WeaponEntry>();
  private activeSwings = new Map<string, { start: number; duration: number }>();
  private katanaModel: THREE.Group | null = null;
  private naginataModel: THREE.Group | null = null;
  private naginataTipZ = -2.5;
  private torchModel: THREE.Group | null = null;
  /** Tracks next swing direction per player: true = Swing A (R→L), false = Swing B (L→R) */
  private nextSwingIsA = new Map<string, boolean>();
  private torchExtras = new Map<string, TorchExtras>();
  /** Players currently in wind-up pose (holding mouseDown) */
  private windUpStates = new Map<string, { keyframes: Keyframe[]; animating: boolean }>();

  constructor(characterRenderer: CharacterRenderer) {
    this.characterRenderer = characterRenderer;
    this.loadKatanaModel();
    this.loadNaginataModel();
    this.loadTorchModel();
  }

  private async loadKatanaModel(): Promise<void> {
    try {
      const loader = new OBJLoader();
      const obj = await loader.loadAsync("/katana.obj");

      const bladeMat = new THREE.MeshToonMaterial({
        color: 0xd0d0d0,
        gradientMap: toonGradientMap,
      });
      const handleMat = new THREE.MeshToonMaterial({
        color: 0x1a0e05,
        gradientMap: toonGradientMap,
      });
      const guardMat = new THREE.MeshToonMaterial({
        color: 0x3a3a3a,
        gradientMap: toonGradientMap,
      });

      obj.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.translate(-OBJ_CENTER_X, -OBJ_HILT_Y, -OBJ_CENTER_Z);
        child.geometry.rotateX(-Math.PI / 2);
        child.geometry.scale(KATANA_SCALE, KATANA_SCALE, KATANA_SCALE);

        if (child.name === "Plane") {
          child.material = bladeMat;
        } else if (child.name === "Cube") {
          child.material = guardMat;
        } else {
          child.material = handleMat;
        }
        child.castShadow = true;
      });

      this.katanaModel = obj;
    } catch (e) {
      console.warn("Failed to load katana.obj, using fallback box");
    }
  }

  private async loadNaginataModel(): Promise<void> {
    try {
      const [gltf, diffuse, normal] = await Promise.all([
        new GLTFLoader().loadAsync("/naginata.glb"),
        new THREE.TextureLoader().loadAsync("/naginata_texture_diffuse.jpg"),
        new THREE.TextureLoader().loadAsync("/naginata_texture_normal.jpg"),
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

      // Normalize: orient along local -Z (blade forward), hilt at origin
      // Measure native bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale so longest axis is ~2.5 units (polearm is longer than katana)
      const targetLength = 2.5;
      const scale = targetLength / maxDim;
      model.scale.setScalar(scale);

      // Recompute after scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());

      // Rotate so the model's longest axis aligns with local -Z
      // Assume the naginata's longest axis is Y (vertical in Blender)
      model.rotation.x = -Math.PI / 2;

      // Recompute after rotation
      const rotatedBox = new THREE.Box3().setFromObject(model);
      const rotatedSize = rotatedBox.getSize(new THREE.Vector3());

      // Shift so hilt end is near z=0 and blade extends into -Z
      model.position.z = -rotatedBox.min.z;
      model.position.y = 0;
      model.position.x = 0;

      // Tip is at the far -Z end
      const finalBox = new THREE.Box3().setFromObject(model);
      this.naginataTipZ = finalBox.min.z;

      this.naginataModel = model;
      console.log(`[WeaponRenderer] Naginata loaded, tipZ=${this.naginataTipZ.toFixed(2)}, size=${rotatedSize.x.toFixed(2)}x${rotatedSize.y.toFixed(2)}x${rotatedSize.z.toFixed(2)}`);
    } catch (e) {
      console.warn("Failed to load naginata.glb, using fallback cylinder", e);
    }
  }

  private async loadTorchModel(): Promise<void> {
    try {
      const [gltf, diffuse, normal] = await Promise.all([
        new GLTFLoader().loadAsync("/torch.glb"),
        new THREE.TextureLoader().loadAsync("/torch_texture_diffuse.jpg"),
        new THREE.TextureLoader().loadAsync("/torch_texture_normal.jpg"),
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

      // Normalize size: fit model to ~1.0 unit tall
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.0 / maxDim;
      model.scale.setScalar(scale);

      // Re-center so base is at y=0
      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.y = -scaledBox.min.y;

      this.torchModel = model;
    } catch (e) {
      console.warn("Failed to load torch.glb, using fallback geometry", e);
    }
  }

  updateWeapon(sessionId: string, weaponType: WeaponType): void {
    const group = this.characterRenderer.getGroup(sessionId);
    if (!group) return;

    const existing = this.weapons.get(sessionId);
    if (existing) {
      group.remove(existing.object);
      this.disposeObject(existing.object);
      this.weapons.delete(sessionId);
    }

    if (weaponType === "lance") {
      if (this.naginataModel) {
        const clone = this.naginataModel.clone(true);
        clone.position.set(REST_POS[0], REST_POS[1], REST_POS[2]);
        clone.rotation.set(REST_ROT[0], REST_ROT[1], REST_ROT[2]);
        group.add(clone);
        this.weapons.set(sessionId, {
          object: clone,
          type: "lance",
          baseLocalZ: 0,
          tipLocalZ: this.naginataTipZ,
        });
      } else {
        // Fallback cylinder
        const geo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshToonMaterial({
          color: 0x8b4513,
          gradientMap: toonGradientMap,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(REST_POS[0], REST_POS[1], REST_POS[2]);
        mesh.rotation.set(REST_ROT[0], REST_ROT[1], REST_ROT[2]);
        mesh.castShadow = true;
        group.add(mesh);
        this.weapons.set(sessionId, {
          object: mesh,
          type: "lance",
          baseLocalZ: 1.25,
          tipLocalZ: -1.25,
        });
      }
      this.nextSwingIsA.set(sessionId, true);
      return;
    }

    if (weaponType === "torch") {
      const torchGroup = new THREE.Group();

      if (this.torchModel) {
        const clone = this.torchModel.clone(true);
        torchGroup.add(clone);
      } else {
        // Fallback procedural geometry
        const stickGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
        const stickMat = new THREE.MeshToonMaterial({
          color: 0x5c3a1e,
          gradientMap: toonGradientMap,
        });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.castShadow = true;
        torchGroup.add(stick);
      }

      // Flame (always added on top for flicker effect)
      const flameGeo = new THREE.SphereGeometry(0.15, 8, 6);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.55;
      torchGroup.add(flame);

      // PointLight at flame tip
      const light = new THREE.PointLight(
        LIGHTING.TORCH_LIGHT_COLOR,
        LIGHTING.TORCH_LIGHT_INTENSITY,
        LIGHTING.TORCH_LIGHT_RANGE,
      );
      light.position.y = 0.55;
      torchGroup.add(light);

      torchGroup.position.set(0.5, 1.0, -0.3);
      torchGroup.rotation.set(0.3, 0, 0);
      group.add(torchGroup);

      this.weapons.set(sessionId, {
        object: torchGroup,
        type: "torch",
        baseLocalZ: 0,
        tipLocalZ: 0,
      });
      this.torchExtras.set(sessionId, { flame, light });
      return;
    }

    // Katana: use OBJ model or fallback box
    const restPos = REST_POS;
    const restRot = REST_ROT;

    if (this.katanaModel) {
      const clone = this.katanaModel.clone(true);
      clone.position.set(restPos[0], restPos[1], restPos[2]);
      clone.rotation.set(restRot[0], restRot[1], restRot[2]);
      group.add(clone);
      this.weapons.set(sessionId, {
        object: clone,
        type: "katana",
        baseLocalZ: 0,
        tipLocalZ: KATANA_TIP_Z,
      });
    } else {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 2.0);
      const mat = new THREE.MeshToonMaterial({
        color: 0xcccccc,
        gradientMap: toonGradientMap,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(restPos[0], restPos[1], restPos[2]);
      mesh.rotation.set(restRot[0], restRot[1], restRot[2]);
      mesh.castShadow = true;
      group.add(mesh);
      this.weapons.set(sessionId, {
        object: mesh,
        type: "katana",
        baseLocalZ: BOX_HALF_LENGTH,
        tipLocalZ: -BOX_HALF_LENGTH,
      });
    }

    // Initialize alternating direction
    this.nextSwingIsA.set(sessionId, true);
  }

  /** Interpolate weapon from rest to wind-up pose (called on mouseDown) */
  startWindUp(sessionId: string): void {
    const entry = this.weapons.get(sessionId);
    if (!entry || entry.type === "torch") return;

    const isA = this.nextSwingIsA.get(sessionId) ?? true;
    const keyframes = isA ? SWING_A : SWING_B;
    const windUp = keyframes[1];

    const state = { keyframes, animating: true };
    this.windUpStates.set(sessionId, state);

    // Interpolate from rest to wind-up over 150ms
    const duration = 150;
    const start = performance.now();
    const obj = entry.object;
    const startPos = [REST_POS[0], REST_POS[1], REST_POS[2]];
    const startRot = [REST_ROT[0], REST_ROT[1], REST_ROT[2]];
    const endPos = windUp.pos;
    const endRot = windUp.rot;

    const animate = (): void => {
      // Stop if wind-up was cancelled or consumed by playSwing
      const current = this.windUpStates.get(sessionId);
      if (!current || !current.animating) return;

      const t = Math.min((performance.now() - start) / duration, 1);
      const eased = EASING_FNS.smoothstep(t);

      obj.position.set(
        startPos[0] + (endPos[0] - startPos[0]) * eased,
        startPos[1] + (endPos[1] - startPos[1]) * eased,
        startPos[2] + (endPos[2] - startPos[2]) * eased,
      );
      obj.rotation.set(
        startRot[0] + (endRot[0] - startRot[0]) * eased,
        startRot[1] + (endRot[1] - startRot[1]) * eased,
        startRot[2] + (endRot[2] - startRot[2]) * eased,
      );

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        state.animating = false;
      }
    };
    animate();
  }

  /** Cancel wind-up, snap back to rest (e.g. stun, death, weapon switch) */
  cancelWindUp(sessionId: string): void {
    if (!this.windUpStates.has(sessionId)) return;
    this.windUpStates.delete(sessionId);

    const entry = this.weapons.get(sessionId);
    if (!entry) return;

    if (entry.type === "katana" || entry.type === "lance") {
      entry.object.position.set(REST_POS[0], REST_POS[1], REST_POS[2]);
      entry.object.rotation.set(REST_ROT[0], REST_ROT[1], REST_ROT[2]);
    }
  }

  playSwing(sessionId: string): SwingHandle | null {
    const entry = this.weapons.get(sessionId);
    if (!entry) return null;

    if (entry.type === "torch") return null;

    const fromWindUp = this.windUpStates.has(sessionId);
    this.windUpStates.delete(sessionId);

    const now = performance.now();

    // Both katana and lance (naginata) use keyframe swing with SwingHandle
    const isA = this.nextSwingIsA.get(sessionId) ?? true;
    const keyframes = isA ? SWING_A : SWING_B;
    this.nextSwingIsA.set(sessionId, !isA);

    const duration = SWING_CONFIG.durationMs;
    // If from wind-up, offset start so animation begins at t=0.15 (wind-up keyframe)
    const windUpT = keyframes[1].t;
    const start = fromWindUp ? now - windUpT * duration : now;
    this.activeSwings.set(sessionId, { start, duration });

    const obj = entry.object;
    const animate = (): void => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const { pos, rot } = lerpKeyframes(keyframes, t);
      obj.position.set(pos.x, pos.y, pos.z);
      obj.rotation.set(rot.x, rot.y, rot.z);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.activeSwings.delete(sessionId);
      }
    };
    animate();

    const baseZ = entry.baseLocalZ;
    const tipZ = entry.tipLocalZ;

    return {
      getBaseWorldPos: (): THREE.Vector3 => {
        return obj.localToWorld(new THREE.Vector3(0, 0, baseZ));
      },
      getTipWorldPos: (): THREE.Vector3 => {
        return obj.localToWorld(new THREE.Vector3(0, 0, tipZ));
      },
      isActive: (): boolean => {
        return this.activeSwings.has(sessionId);
      },
    };
  }

  refreshRestPose(sessionId?: string): void {
    const entries = sessionId
      ? [{ key: sessionId, entry: this.weapons.get(sessionId) }]
      : Array.from(this.weapons.entries()).map(([key, entry]) => ({
          key,
          entry,
        }));

    for (const { key, entry } of entries) {
      if (!entry || (entry.type !== "katana" && entry.type !== "lance")) continue;
      if (this.activeSwings.has(key)) continue;
      entry.object.position.set(REST_POS[0], REST_POS[1], REST_POS[2]);
      entry.object.rotation.set(REST_ROT[0], REST_ROT[1], REST_ROT[2]);
    }
  }

  updateTorchFlicker(): void {
    const time = performance.now() * 0.001;
    for (const [, extras] of this.torchExtras) {
      const flicker = 0.85 + 0.15 * Math.sin(time * 12 + Math.random() * 0.5);
      extras.light.intensity = LIGHTING.TORCH_LIGHT_INTENSITY * flicker;
      const scaleFlicker = 0.9 + 0.1 * Math.sin(time * 15);
      extras.flame.scale.setScalar(scaleFlicker);
    }
  }

  removeWeapon(sessionId: string): void {
    const group = this.characterRenderer.getGroup(sessionId);
    const entry = this.weapons.get(sessionId);
    if (group && entry) {
      group.remove(entry.object);
      this.disposeObject(entry.object);
    }
    this.weapons.delete(sessionId);
    this.activeSwings.delete(sessionId);
    this.nextSwingIsA.delete(sessionId);
    this.torchExtras.delete(sessionId);
    this.windUpStates.delete(sessionId);
  }

  removeAll(): void {
    for (const sessionId of [...this.weapons.keys()]) {
      this.removeWeapon(sessionId);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
