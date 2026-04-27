import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradientMap } from "../render/ToonGradient.js";
import type { SwingHandle } from "../render/WeaponRenderer.js";

// ─── Simple slash (lance / fallback) ────────────────────────────────────────

interface SimpleSlash {
  kind: "simple";
  mesh: THREE.Mesh;
  lifetime: number;
  maxLifetime: number;
}

// ─── Swept surface slash (katana) ───────────────────────────────────────────

interface BladeSample {
  base: THREE.Vector3;
  tip: THREE.Vector3;
}

interface SweptSlash {
  kind: "swept";
  mesh: THREE.Mesh | null;
  material: THREE.ShaderMaterial;
  samples: BladeSample[];
  swingHandle: SwingHandle;
  lifetime: number;
  swingDone: boolean;
}

interface HitSparks {
  kind: "sparks";
  points: THREE.Points;
  velocities: THREE.Vector3[];
  lifetime: number;
  maxLifetime: number;
}

type Effect = SimpleSlash | SweptSlash | HitSparks;

// ─── Shaders ────────────────────────────────────────────────────────────────

const SWEPT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SWEPT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSwingProgress;
  varying vec2 vUv;

  // Simple pseudo-noise from UV
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // vUv.x = 0 at hilt, 1 at tip
    // vUv.y = 0 at swing start, 1 at swing end

    // ── Flame color gradient: white-hot core → gold → orange at edges ──
    vec3 white = vec3(1.0, 0.97, 0.9);
    vec3 gold  = vec3(1.0, 0.8, 0.3);
    vec3 ember = vec3(1.0, 0.4, 0.1);

    // Core runs along the center of the blade sweep
    float centerDist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edges
    vec3 color = mix(white, gold, centerDist);
    color = mix(color, ember, smoothstep(0.5, 1.0, centerDist));

    // ── Flame distortion: wispy tendrils that crawl along the surface ──
    float noise1 = hash(vUv * 8.0 + uTime * 3.0);
    float noise2 = hash(vUv * 12.0 - uTime * 2.0 + 0.5);
    float flameNoise = (noise1 + noise2) * 0.5;

    // Flame wisps: dissolve edges with noisy threshold
    float flameMask = smoothstep(0.0, 0.3 + flameNoise * 0.15, vUv.x)
                    * smoothstep(1.0, 0.7 - flameNoise * 0.15, vUv.x);

    // ── Trailing fade: older parts of the swing dissolve first ──
    // swingProgress goes from 0→1 during the swing
    // Newer samples (vUv.y close to swingProgress) are bright,
    // older ones dissolve with a flame-like edge
    float age = uSwingProgress - vUv.y;
    float trailFade = smoothstep(0.7 + flameNoise * 0.2, 0.0, age);

    // ── Hilt fade (narrow at handle) ──
    float hiltFade = smoothstep(0.0, 0.12, vUv.x);

    // ── Swing start/end edge fade ──
    float edgeFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);

    // ── Soft glow pulse ──
    float pulse = 0.92 + 0.08 * sin(uTime * 8.0 + vUv.y * 6.0);

    // ── Combine ──
    float alpha = hiltFade * edgeFade * flameMask * trailFade * pulse * uOpacity;
    // Brighten core with additive HDR-like boost
    float brightness = 1.4 + 0.3 * (1.0 - centerDist);
    gl_FragColor = vec4(color * brightness, alpha * 0.9);
  }
`;

// ─── Main class ─────────────────────────────────────────────────────────────

interface KawariminFall {
  group: THREE.Group;
  startY: number;
  targetY: number;
  elapsedMs: number;
  durationMs: number;
  smokePlanes: THREE.Mesh[];
  onComplete: (() => void) | null;
}

export class CombatVisuals {
  private scene: THREE.Scene;
  private effects: Effect[] = [];
  private clock = 0;
  private kawariminMarker: THREE.Group | null = null;
  private kawariminMarkerMat: THREE.MeshBasicMaterial | null = null;
  private kawariminModel: THREE.Group | null = null;
  private kawariminModelScale = 1;
  private kawariminFall: KawariminFall | null = null;
  private smokeTexture: THREE.Texture | null = null;
  private camera: THREE.Camera | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    new THREE.TextureLoader().load("/smoke_01.png", (tex) => {
      this.smokeTexture = tex;
    });
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  async loadModel(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    try {
      const [gltf, diffuse, normal] = await Promise.all([
        gltfLoader.loadAsync("/kawarimi.glb"),
        texLoader.loadAsync("/kawarimi_texture_diffuse.jpg"),
        texLoader.loadAsync("/kawarimi_texture_normal.jpg"),
      ]);

      diffuse.colorSpace = THREE.SRGBColorSpace;
      normal.colorSpace = THREE.LinearSRGBColorSpace;
      diffuse.flipY = false;
      normal.flipY = false;

      this.kawariminModel = gltf.scene;
      this.kawariminModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshToonMaterial({
            map: diffuse,
            normalMap: normal,
            gradientMap: toonGradientMap,
          });
          child.castShadow = true;
        }
      });

      // Scale to ~1m tall
      const box = new THREE.Box3().setFromObject(this.kawariminModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      this.kawariminModelScale = maxDim > 0 ? 1.0 / maxDim : 1;
    } catch (err) {
      console.warn("Failed to load kawarimi model/textures", err);
    }
  }

  showSimpleSlash(x: number, y: number, z: number, rotationY: number): void {
    const geo = new THREE.TorusGeometry(1.2, 0.03, 4, 12, Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    mat.userData.outlineParameters = { visible: false };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 1.2, z);
    mesh.rotation.y = rotationY;
    mesh.rotation.x = -Math.PI / 6;
    this.scene.add(mesh);
    this.effects.push({ kind: "simple", mesh, lifetime: 0, maxLifetime: 200 });
  }

  showSlash(
    x: number, y: number, z: number,
    rotationY: number,
    swingHandle?: SwingHandle | null,
  ): void {
    if (!swingHandle) {
      this.showSimpleSlash(x, y, z, rotationY);
      return;
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: SWEPT_VERTEX,
      fragmentShader: SWEPT_FRAGMENT,
      uniforms: {
        uOpacity: { value: 1.0 },
        uTime: { value: 0 },
        uSwingProgress: { value: 0.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Prevent OutlineEffect from drawing black edges on the trail
    material.userData.outlineParameters = { visible: false };

    this.effects.push({
      kind: "swept",
      mesh: null,
      material,
      samples: [],
      swingHandle,
      lifetime: 0,
      swingDone: false,
    });
  }

  showHitSparks(x: number, y: number, z: number, backstab = false): void {
    const count = backstab ? 36 : 18;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    const palette = backstab
      ? [
          new THREE.Color(1.0, 0.3, 1.0),   // magenta
          new THREE.Color(0.8, 0.0, 0.8),   // purple
          new THREE.Color(1.0, 0.1, 0.3),   // crimson
        ]
      : [
          new THREE.Color(1.0, 0.97, 0.9),  // white-hot
          new THREE.Color(1.0, 0.8, 0.3),   // gold
          new THREE.Color(1.0, 0.4, 0.1),   // ember
        ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y + 1.2;
      positions[i * 3 + 2] = z;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Random burst direction, biased upward (backstab = bigger burst)
      const spread = backstab ? 6 : 4;
      const upForce = backstab ? 4 : 3;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * upForce + 1,
        (Math.random() - 0.5) * spread,
      ));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: backstab ? 0.18 : 0.12,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    mat.userData.outlineParameters = { visible: false };

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.effects.push({ kind: "sparks", points, velocities, lifetime: 0, maxLifetime: 500 });
  }

  showDashTrail(fromX: number, fromZ: number, toX: number, toZ: number): void {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    const palette = [
      new THREE.Color(0.3, 0.0, 0.5),   // dark purple
      new THREE.Color(0.5, 0.0, 0.8),   // violet
      new THREE.Color(0.1, 0.0, 0.2),   // near-black
    ];

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 0.8;
      const z = fromZ + (toZ - fromZ) * t + (Math.random() - 0.5) * 0.8;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0.8 + Math.random() * 1.2;
      positions[i * 3 + 2] = z;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2 + 0.5,
        (Math.random() - 0.5) * 2,
      ));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    mat.userData.outlineParameters = { visible: false };

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.effects.push({ kind: "sparks", points, velocities, lifetime: 0, maxLifetime: 600 });
  }

  showBlockSparks(x: number, y: number, z: number): void {
    const count = 24;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    const palette = [
      new THREE.Color(0.6, 0.8, 1.0),  // light blue
      new THREE.Color(1.0, 1.0, 1.0),  // white
      new THREE.Color(0.3, 0.6, 1.0),  // blue
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y + 1.2;
      positions[i * 3 + 2] = z;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 5,
      ));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    mat.userData.outlineParameters = { visible: false };

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.effects.push({ kind: "sparks", points, velocities, lifetime: 0, maxLifetime: 400 });
  }

  showKawariminMarker(x: number, z: number): void {
    this.removeKawariminMarker();

    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xccaa00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    ringMat.userData.outlineParameters = { visible: false };

    const group = new THREE.Group();
    group.position.set(x, 0.03, z);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    this.scene.add(group);
    this.kawariminMarker = group;
    this.kawariminMarkerMat = ringMat;
  }

  removeKawariminMarker(): void {
    if (this.kawariminMarker) {
      this.kawariminMarker.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
      this.scene.remove(this.kawariminMarker);
      this.kawariminMarker = null;
      this.kawariminMarkerMat = null;
    }
  }

  showKawariminEffect(x: number, z: number, onComplete: (() => void) | null = null): void {
    const FALL_DURATION_MS = 600;
    const SMOKE_COUNT = 20;
    const SMOKE_PLANE_SIZE = 3;
    const startY = 2.0; // ninja height

    const group = new THREE.Group();
    group.position.set(x, startY, z);

    // Spawn kawarimi.glb model (wood pieces)
    if (this.kawariminModel) {
      const clone = this.kawariminModel.clone(true);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = (child.material as THREE.Material).clone();
          child.castShadow = true;
        }
      });
      clone.scale.setScalar(this.kawariminModelScale);
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.y = -box.min.y;
      group.add(clone);
    } else {
      // Fallback: brown cylinder
      const logGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8);
      const logMat = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
      logMat.userData.outlineParameters = { visible: false };
      const logMesh = new THREE.Mesh(logGeo, logMat);
      logMesh.rotation.z = Math.PI / 2;
      group.add(logMesh);
    }

    // White smoke planes (like SmokeBombVisual)
    const smokePlanes: THREE.Mesh[] = [];
    const planeGeo = new THREE.PlaneGeometry(SMOKE_PLANE_SIZE, SMOKE_PLANE_SIZE);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: 0xcccccc,
        map: this.smokeTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      mat.userData.outlineParameters = { visible: false };
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 2,
        startY * 0.5 + (Math.random() - 0.3) * 1.5,
        z + (Math.random() - 0.5) * 2,
      );
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      smokePlanes.push(mesh);
    }

    this.scene.add(group);
    this.kawariminFall = {
      group,
      startY,
      targetY: 0,
      elapsedMs: 0,
      durationMs: FALL_DURATION_MS,
      smokePlanes,
      onComplete,
    };
  }

  update(deltaMs: number): void {
    this.clock += deltaMs / 1000;

    // Pulse kawarimi ground marker
    if (this.kawariminMarker && this.kawariminMarkerMat) {
      this.kawariminMarkerMat.opacity = 0.3 + Math.sin(this.clock * 3) * 0.15;
    }

    // Animate kawarimi fall + smoke
    if (this.kawariminFall) {
      this.updateKawariminFall(deltaMs);
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      if (effect.kind === "simple") {
        this.updateSimple(effect, deltaMs, i);
      } else if (effect.kind === "swept") {
        this.updateSwept(effect, deltaMs, i);
      } else {
        this.updateSparks(effect, deltaMs, i);
      }
    }
  }

  private updateSimple(effect: SimpleSlash, deltaMs: number, index: number): void {
    effect.lifetime += deltaMs;
    const t = effect.lifetime / effect.maxLifetime;
    (effect.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    effect.mesh.scale.setScalar(1 + t * 0.5);

    if (effect.lifetime >= effect.maxLifetime) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      (effect.mesh.material as THREE.Material).dispose();
      this.effects.splice(index, 1);
    }
  }

  private updateSwept(effect: SweptSlash, deltaMs: number, index: number): void {
    effect.lifetime += deltaMs;
    const SWING_DURATION = 400;
    const FADE_DURATION = 300;
    const TOTAL_DURATION = SWING_DURATION + FADE_DURATION;

    effect.material.uniforms.uTime.value = this.clock;

    // Drive swing progress (0→1 over swing duration)
    const swingT = Math.min(effect.lifetime / SWING_DURATION, 1.0);
    effect.material.uniforms.uSwingProgress.value = swingT;

    // ─── Phase 1: Sample blade positions during swing ──────────────
    if (!effect.swingDone && effect.swingHandle.isActive()) {
      const base = effect.swingHandle.getBaseWorldPos();
      const tip = effect.swingHandle.getTipWorldPos();
      effect.samples.push({ base: base.clone(), tip: tip.clone() });

      // Rebuild ribbon mesh from samples
      this.rebuildRibbon(effect);
    }

    // ─── Swing ended ───────────────────────────────────────────────
    if (!effect.swingDone && (effect.lifetime > SWING_DURATION || !effect.swingHandle.isActive())) {
      effect.swingDone = true;
    }

    // ─── Phase 2: Fade out ─────────────────────────────────────────
    if (effect.swingDone) {
      const fadeElapsed = effect.lifetime - SWING_DURATION;
      const fadeT = Math.min(Math.max(fadeElapsed, 0) / FADE_DURATION, 1.0);
      effect.material.uniforms.uOpacity.value = 1.0 - fadeT;
    }

    // ─── Cleanup ──────────────────────────────────────────────────
    if (effect.lifetime >= TOTAL_DURATION) {
      if (effect.mesh) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
      }
      effect.material.dispose();
      this.effects.splice(index, 1);
    }
  }

  private updateSparks(effect: HitSparks, deltaMs: number, index: number): void {
    effect.lifetime += deltaMs;
    const dt = deltaMs / 1000;
    const t = effect.lifetime / effect.maxLifetime;

    const posAttr = effect.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < effect.velocities.length; i++) {
      const vel = effect.velocities[i];
      // Gravity
      vel.y -= 9.8 * dt;
      arr[i * 3] += vel.x * dt;
      arr[i * 3 + 1] += vel.y * dt;
      arr[i * 3 + 2] += vel.z * dt;
    }
    posAttr.needsUpdate = true;

    (effect.points.material as THREE.PointsMaterial).opacity = 1.0 - t;

    if (effect.lifetime >= effect.maxLifetime) {
      this.scene.remove(effect.points);
      effect.points.geometry.dispose();
      (effect.points.material as THREE.Material).dispose();
      this.effects.splice(index, 1);
    }
  }

  private updateKawariminFall(deltaMs: number): void {
    const fall = this.kawariminFall!;
    fall.elapsedMs += deltaMs;
    const dt = deltaMs / 1000;

    const TOTAL_MS = fall.durationMs + 2000; // fall + linger
    const t = Math.min(1, fall.elapsedMs / fall.durationMs);

    // Ease-in fall (gravity-like)
    const eased = t * t;
    fall.group.position.y = fall.startY + (fall.targetY - fall.startY) * eased;

    // Smoke: fade in quickly, expand outward, billboard toward camera, then fade out
    const smokeExpandT = Math.min(1, fall.elapsedMs / 800);
    let smokeOpacity = 0.7;
    if (fall.elapsedMs < 300) {
      smokeOpacity *= fall.elapsedMs / 300;
    }
    if (fall.elapsedMs > fall.durationMs) {
      smokeOpacity *= Math.max(0, 1 - (fall.elapsedMs - fall.durationMs) / 2000);
    }

    for (const plane of fall.smokePlanes) {
      // Scale up as smoke expands
      const scale = 0.3 + smokeExpandT * 0.7;
      plane.scale.setScalar(scale);
      // Drift upward slowly
      plane.position.y += dt * 0.4;
      // Billboard toward camera
      if (this.camera) {
        const zRot = plane.rotation.z;
        plane.lookAt(this.camera.position);
        plane.rotation.z = zRot + dt * 0.2;
      }
      (plane.material as THREE.MeshLambertMaterial).opacity = smokeOpacity;
    }

    // Cleanup after full animation
    if (fall.elapsedMs >= TOTAL_MS) {
      // Remove wood model
      fall.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
      this.scene.remove(fall.group);

      // Remove smoke planes
      for (const plane of fall.smokePlanes) {
        this.scene.remove(plane);
        (plane.material as THREE.Material).dispose();
      }
      if (fall.smokePlanes.length > 0) {
        fall.smokePlanes[0].geometry.dispose();
      }

      fall.onComplete?.();
      this.kawariminFall = null;
    }
  }

  private rebuildRibbon(effect: SweptSlash): void {
    const samples = effect.samples;
    if (samples.length < 2) return;

    // Remove old mesh
    if (effect.mesh) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
    }

    const n = samples.length;
    // 2 vertices per sample (base + tip), forming a quad strip
    const positions = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const v = i / (n - 1); // 0..1 along swing arc

      // Vertex 0: base (hilt)
      const idx0 = i * 2;
      positions[idx0 * 3] = s.base.x;
      positions[idx0 * 3 + 1] = s.base.y;
      positions[idx0 * 3 + 2] = s.base.z;
      uvs[idx0 * 2] = 0;     // u = 0 at hilt
      uvs[idx0 * 2 + 1] = v; // v along swing

      // Vertex 1: tip
      const idx1 = i * 2 + 1;
      positions[idx1 * 3] = s.tip.x;
      positions[idx1 * 3 + 1] = s.tip.y;
      positions[idx1 * 3 + 2] = s.tip.z;
      uvs[idx1 * 2] = 1;     // u = 1 at tip
      uvs[idx1 * 2 + 1] = v;

      // Connect quads between consecutive samples
      if (i < n - 1) {
        const a = idx0;     // this base
        const b = idx1;     // this tip
        const c = (i + 1) * 2;     // next base
        const d = (i + 1) * 2 + 1; // next tip
        // Two triangles per quad
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, effect.material);
    this.scene.add(mesh);
    effect.mesh = mesh;
  }
}
