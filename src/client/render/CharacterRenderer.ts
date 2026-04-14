import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "./ToonGradient.js";

const CHARACTER_COLORS: Record<string, number> = {
  ninja: 0x8800cc,
  samurai: 0xcc2222,
  shogun: 0xffcc00,
};

const STUN_STAR_COUNT = 4;
const STUN_ORBIT_RADIUS = 0.5;
const STUN_ORBIT_HEIGHT = 2.4;
const STUN_STAR_COLOR = 0xffdd00;
const STUN_SPIN_SPEED = 4; // radians per second

interface CharacterEntity {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetRot: number;
  currentRot: number;
  currentWeapon: string;
  dead: boolean;
  deathStartTime: number;
  deathFaded: boolean;
  stunGroup: THREE.Group | null;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private entities = new Map<string, CharacterEntity>();
  private ninjaModel: THREE.Group | null = null;
  private ninjaDiffuse: THREE.Texture | null = null;
  private ninjaNormal: THREE.Texture | null = null;
  private ninjaPBR: THREE.Texture | null = null;
  private samuraiModel: THREE.Group | null = null;
  private samuraiDiffuse: THREE.Texture | null = null;
  private samuraiNormal: THREE.Texture | null = null;
  private samuraiPBR: THREE.Texture | null = null;
  private shogunModel: THREE.Group | null = null;
  private shogunDiffuse: THREE.Texture | null = null;
  private shogunNormal: THREE.Texture | null = null;
  private shogunPBR: THREE.Texture | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async loadModel(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const prepareTextures = (diffuse: THREE.Texture, normal: THREE.Texture, pbr: THREE.Texture) => {
      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      pbr.colorSpace = THREE.LinearSRGBColorSpace;
      diffuse.flipY = false;
      normal.flipY = false;
      pbr.flipY = false;
    };

    const applyToonMaterial = (model: THREE.Group, diffuse: THREE.Texture, normal: THREE.Texture) => {
      model.traverse((child) => {
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
    };

    // Load all character assets in parallel
    const [ninjaResult, samuraiResult, shogunResult] = await Promise.allSettled([
      Promise.all([
        gltfLoader.loadAsync("/ninja.glb"),
        texLoader.loadAsync("/ninja_texture_diffuse.jpg"),
        texLoader.loadAsync("/ninja_texture_normal.jpg"),
        texLoader.loadAsync("/ninja_texture_pbr.jpg"),
      ]),
      Promise.all([
        gltfLoader.loadAsync("/samurai.glb"),
        texLoader.loadAsync("/samurai_texture_diffuse.jpg"),
        texLoader.loadAsync("/samurai_texture_normal.jpg"),
        texLoader.loadAsync("/samurai_texture_pbr.jpg"),
      ]),
      Promise.all([
        gltfLoader.loadAsync("/shogun.glb"),
        texLoader.loadAsync("/shogun_texture_diffuse.jpg"),
        texLoader.loadAsync("/shogun_texture_normal.jpg"),
        texLoader.loadAsync("/shogun_texture_pbr.jpg"),
      ]),
    ]);

    if (ninjaResult.status === "fulfilled") {
      const [gltf, diffuse, normal, pbr] = ninjaResult.value;
      prepareTextures(diffuse, normal, pbr);
      this.ninjaDiffuse = diffuse;
      this.ninjaNormal = normal;
      this.ninjaPBR = pbr;
      this.ninjaModel = gltf.scene;
      applyToonMaterial(this.ninjaModel, diffuse, normal);
    } else {
      console.warn("Failed to load ninja model/textures", ninjaResult.reason);
    }

    if (samuraiResult.status === "fulfilled") {
      const [gltf, diffuse, normal, pbr] = samuraiResult.value;
      prepareTextures(diffuse, normal, pbr);
      this.samuraiDiffuse = diffuse;
      this.samuraiNormal = normal;
      this.samuraiPBR = pbr;
      this.samuraiModel = gltf.scene;
      applyToonMaterial(this.samuraiModel, diffuse, normal);
    } else {
      console.warn("Failed to load samurai model/textures", samuraiResult.reason);
    }

    if (shogunResult.status === "fulfilled") {
      const [gltf, diffuse, normal, pbr] = shogunResult.value;
      prepareTextures(diffuse, normal, pbr);
      this.shogunDiffuse = diffuse;
      this.shogunNormal = normal;
      this.shogunPBR = pbr;
      this.shogunModel = gltf.scene;
      applyToonMaterial(this.shogunModel, diffuse, normal);
    } else {
      console.warn("Failed to load shogun model/textures", shogunResult.reason);
    }
  }

  addPlayer(sessionId: string, role: string, x: number, y: number, z: number): void {
    if (this.entities.has(sessionId)) return;

    const color = CHARACTER_COLORS[role] ?? 0xcccccc;
    const group = new THREE.Group();

    const roleModel = role === "shogun" ? this.shogunModel
      : role === "samurai" ? this.samuraiModel
      : this.ninjaModel;
    const baseModel = roleModel ?? this.ninjaModel;

    if (baseModel) {
      const clone = baseModel.clone(true);
      // Clone materials per instance (no tint — keep original textures)
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = (child.material as THREE.MeshToonMaterial).clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Rotate model 180° so it faces away from camera (forward direction)
      clone.rotation.y = Math.PI;
      // Fit model: scale so it stands ~2m tall
      const box = new THREE.Box3().setFromObject(clone);
      const height = box.max.y - box.min.y;
      const targetHeight = 2.0;
      const scale = targetHeight / height;
      const roleScale = (role === "samurai" || role === "shogun") ? 1.1 : 1.0;
      clone.scale.setScalar(scale * roleScale);
      // Recompute box after scaling and offset so feet sit at y=0
      const scaledBox = new THREE.Box3().setFromObject(clone);
      clone.position.y = -scaledBox.min.y;
      group.add(clone);
    } else {
      // Fallback: cylinder + sphere
      const material = new THREE.MeshToonMaterial({ color, gradientMap: toonGradientMap });
      const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 12);
      const body = new THREE.Mesh(bodyGeom, material);
      body.position.y = 0.9;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const headGeom = new THREE.SphereGeometry(0.25, 8, 8);
      const head = new THREE.Mesh(headGeom, material);
      head.position.y = 2.05;
      head.castShadow = true;
      group.add(head);
    }

    group.position.set(x, y, z);
    this.scene.add(group);

    this.entities.set(sessionId, {
      group,
      targetPos: new THREE.Vector3(x, y, z),
      targetRot: 0,
      currentRot: 0,
      currentWeapon: "",
      dead: false,
      deathStartTime: 0,
      deathFaded: false,
      stunGroup: null,
    });
  }

  removePlayer(sessionId: string): void {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

    this.endStun(sessionId);
    this.scene.remove(entity.group);
    entity.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    this.entities.delete(sessionId);
  }

  removeAll(): void {
    for (const sessionId of [...this.entities.keys()]) {
      this.removePlayer(sessionId);
    }
  }

  updatePlayer(sessionId: string, x: number, y: number, z: number, rotation: number): void {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

    entity.targetPos.set(x, y, z);
    entity.targetRot = rotation;
  }

  playDeath(sessionId: string): void {
    const entity = this.entities.get(sessionId);
    if (!entity || entity.dead) return;
    entity.dead = true;
    entity.deathStartTime = performance.now();
    // Switch to YXZ so rotation.x tips forward in character-local space
    entity.group.rotation.order = "YXZ";
  }

  startStun(sessionId: string): void {
    const entity = this.entities.get(sessionId);
    if (!entity || entity.stunGroup) return;

    const orbit = new THREE.Group();
    orbit.position.y = STUN_ORBIT_HEIGHT;

    const starGeo = new THREE.OctahedronGeometry(0.1, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: STUN_STAR_COLOR });

    for (let i = 0; i < STUN_STAR_COUNT; i++) {
      const angle = (i / STUN_STAR_COUNT) * Math.PI * 2;
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        Math.cos(angle) * STUN_ORBIT_RADIUS,
        0,
        Math.sin(angle) * STUN_ORBIT_RADIUS,
      );
      orbit.add(star);
    }

    entity.group.add(orbit);
    entity.stunGroup = orbit;
  }

  endStun(sessionId: string): void {
    const entity = this.entities.get(sessionId);
    if (!entity || !entity.stunGroup) return;

    entity.group.remove(entity.stunGroup);
    entity.stunGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });
    entity.stunGroup = null;
  }

  interpolateAll(lerpFactor: number = 0.15): void {
    const time = performance.now() * 0.001;

    for (const entity of this.entities.values()) {
      if (entity.dead) {
        this.animateDeath(entity);
        continue;
      }

      entity.group.position.lerp(entity.targetPos, lerpFactor);

      // Smoothly interpolate rotation (handle wrapping)
      let rotDiff = entity.targetRot - entity.currentRot;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      entity.currentRot += rotDiff * lerpFactor;
      entity.group.rotation.y = entity.currentRot + Math.PI;

      // Spin stun stars
      if (entity.stunGroup) {
        entity.stunGroup.rotation.y = time * STUN_SPIN_SPEED;
      }
    }
  }

  private animateDeath(entity: CharacterEntity): void {
    const elapsed = performance.now() - entity.deathStartTime;
    const duration = 600;
    const t = Math.min(1, elapsed / duration);
    const eased = t * (2 - t); // easeOutQuad

    // Fall forward in character's local space
    entity.group.rotation.x = -eased * (Math.PI / 2);

    // Fade materials after animation completes
    if (t >= 1 && !entity.deathFaded) {
      entity.deathFaded = true;
      entity.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          if (mat instanceof THREE.Material) {
            mat.transparent = true;
            mat.opacity = 0.4;
          }
        }
      });
    }
  }

  getEntity(sessionId: string): CharacterEntity | undefined {
    return this.entities.get(sessionId);
  }

  setStealth(sessionId: string, isStealth: boolean): void {
    const entity = this.entities.get(sessionId);
    if (!entity || entity.dead) return;

    entity.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat instanceof THREE.Material) {
          mat.transparent = true;
          mat.opacity = isStealth ? 0.3 : 1.0;
        }
      }
    });
  }

  getGroup(sessionId: string): THREE.Group | undefined {
    return this.entities.get(sessionId)?.group;
  }
}
