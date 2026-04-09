import * as THREE from "three";
import { toonGradientMap } from "./ToonGradient.js";

interface ProjectileState {
  x: number;
  y: number;
  z: number;
  type: "water_bomb" | "smoke_bomb";
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  progress: number;
  smokeBombRadius?: number;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  state: ProjectileState;
}

interface SmokeEffect {
  mesh: THREE.Mesh;
  radius: number;
  maxRadius: number;
  age: number;
  maxAge: number;
}

const PROJECTILE_COLORS: Record<string, number> = {
  water_bomb: 0x4488ff,
  smoke_bomb: 0x888888,
};

export class EffectRenderer {
  private scene: THREE.Scene;
  private projectiles = new Map<string, ActiveProjectile>();
  private smokeEffects: SmokeEffect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addProjectile(id: string, state: ProjectileState): void {
    if (this.projectiles.has(id)) return;

    const color = PROJECTILE_COLORS[state.type] ?? 0xffffff;
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshToonMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      gradientMap: toonGradientMap,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(state.x, state.y, state.z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.projectiles.set(id, { mesh, state });
  }

  removeProjectile(id: string): void {
    const proj = this.projectiles.get(id);
    if (!proj) return;

    // If smoke bomb, create smoke impact effect
    if (proj.state.type === "smoke_bomb") {
      this.createSmokeImpact(
        proj.mesh.position.x,
        proj.mesh.position.y,
        proj.mesh.position.z,
        proj.state.smokeBombRadius ?? 5,
      );
    }

    this.scene.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    if (proj.mesh.material instanceof THREE.Material) {
      proj.mesh.material.dispose();
    }
    this.projectiles.delete(id);
  }

  updateProjectile(id: string, state: Partial<ProjectileState>): void {
    const proj = this.projectiles.get(id);
    if (!proj) return;

    Object.assign(proj.state, state);
  }

  update(dt: number): void {
    // Interpolate projectile positions with parabolic Y arc
    for (const proj of this.projectiles.values()) {
      const s = proj.state;
      const t = s.progress;

      // Linear interpolation on XZ, parabolic arc on Y
      const interpX = s.startX + (s.targetX - s.startX) * t;
      const interpZ = s.startZ + (s.targetZ - s.startZ) * t;
      const baseY = s.startY + (s.targetY - s.startY) * t;
      // Parabolic arc: peaks at t=0.5
      const arcHeight = 4.0 * t * (1.0 - t) * 3.0;
      const interpY = baseY + arcHeight;

      proj.mesh.position.set(interpX, interpY, interpZ);
    }

    // Update smoke effects
    const dtSeconds = dt / 1000;
    for (let i = this.smokeEffects.length - 1; i >= 0; i--) {
      const effect = this.smokeEffects[i];
      effect.age += dtSeconds;

      if (effect.age >= effect.maxAge) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        if (effect.mesh.material instanceof THREE.Material) {
          effect.mesh.material.dispose();
        }
        this.smokeEffects.splice(i, 1);
        continue;
      }

      // Expand radius
      const progress = effect.age / effect.maxAge;
      const currentRadius = effect.maxRadius * Math.min(1.0, progress * 3.0);
      effect.mesh.scale.setScalar(currentRadius / 0.1); // 0.1 is base sphere radius

      // Fade out
      const material = effect.mesh.material as THREE.MeshToonMaterial;
      material.opacity = 0.2 * (1.0 - progress);
    }
  }

  private createSmokeImpact(x: number, y: number, z: number, maxRadius: number): void {
    const geometry = new THREE.SphereGeometry(0.1, 12, 12);
    const material = new THREE.MeshToonMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.2,
      gradientMap: toonGradientMap,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y + 0.5, z);
    this.scene.add(mesh);

    this.smokeEffects.push({
      mesh,
      radius: 0,
      maxRadius,
      age: 0,
      maxAge: 4.0,
    });
  }

  dispose(): void {
    for (const [id] of this.projectiles) {
      this.removeProjectile(id);
    }
    for (const effect of this.smokeEffects) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      if (effect.mesh.material instanceof THREE.Material) {
        effect.mesh.material.dispose();
      }
    }
    this.smokeEffects.length = 0;
  }
}
