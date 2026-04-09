import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { CharacterRenderer } from "./CharacterRenderer.js";
import { toonGradientMap } from "./ToonGradient.js";

type WeaponType = "katana" | "lance";

export interface SwingHandle {
  getBaseWorldPos(): THREE.Vector3;
  getTipWorldPos(): THREE.Vector3;
  isActive(): boolean;
}

const LANCE_CONFIG = {
  geometry: new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6),
  color: 0x8b4513,
  offset: new THREE.Vector3(0.5, 1.4, -0.5),
  rotation: new THREE.Euler(0.5, 0, 0),
};

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

function smoothstep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
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
  const localT = smoothstep(kf0.t, kf1.t, t);

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
  { t: 0.8, pos: [0.48, 0.8, -0.41], rot: [2.15, -2.05, -1.54] }, // follow-through far right
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

export class WeaponRenderer {
  private characterRenderer: CharacterRenderer;
  private weapons = new Map<string, WeaponEntry>();
  private activeSwings = new Map<string, { start: number; duration: number }>();
  private katanaModel: THREE.Group | null = null;
  /** Tracks next swing direction per player: true = Swing A (R→L), false = Swing B (L→R) */
  private nextSwingIsA = new Map<string, boolean>();

  constructor(characterRenderer: CharacterRenderer) {
    this.characterRenderer = characterRenderer;
    this.loadKatanaModel();
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
      const mat = new THREE.MeshToonMaterial({
        color: LANCE_CONFIG.color,
        gradientMap: toonGradientMap,
      });
      const mesh = new THREE.Mesh(LANCE_CONFIG.geometry.clone(), mat);
      mesh.position.copy(LANCE_CONFIG.offset);
      mesh.rotation.copy(LANCE_CONFIG.rotation);
      mesh.castShadow = true;
      group.add(mesh);
      this.weapons.set(sessionId, {
        object: mesh,
        type: "lance",
        baseLocalZ: 1.0,
        tipLocalZ: -1.0,
      });
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

  playSwing(sessionId: string): SwingHandle | null {
    const entry = this.weapons.get(sessionId);
    if (!entry) return null;

    const start = performance.now();

    if (entry.type === "lance") {
      const duration = 200;
      const originalRotX = entry.object.rotation.x;
      const swing = (): void => {
        const t = Math.min((performance.now() - start) / duration, 1);
        entry.object.rotation.x = originalRotX + Math.sin(t * Math.PI) * -1.2;
        if (t < 1) requestAnimationFrame(swing);
      };
      swing();
      return null;
    }

    // Katana: pick alternating keyframes
    const isA = this.nextSwingIsA.get(sessionId) ?? true;
    const keyframes = isA ? SWING_A : SWING_B;
    this.nextSwingIsA.set(sessionId, !isA);

    const duration = 400;
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
      if (!entry || entry.type !== "katana") continue;
      if (this.activeSwings.has(key)) continue;
      entry.object.position.set(REST_POS[0], REST_POS[1], REST_POS[2]);
      entry.object.rotation.set(REST_ROT[0], REST_ROT[1], REST_ROT[2]);
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
