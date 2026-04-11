import * as THREE from "three";

const PARTICLE_COUNT = 50;
const PLANE_SIZE = 5;

interface SmokeParticle {
  mesh: THREE.Mesh;
  /** Offset from cloud center */
  offset: THREE.Vector3;
  /** Base Z rotation + slow spin */
  spinSpeed: number;
}

interface SmokeCloud {
  particles: SmokeParticle[];
  center: THREE.Vector3;
  targetRadius: number;
  lifetime: number;
  maxLifetime: number;
  baseOpacity: number;
}

export class SmokeBombVisual {
  private scene: THREE.Scene;
  private clouds: SmokeCloud[] = [];
  private camera: THREE.Camera | null = null;
  private smokeTexture: THREE.Texture | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    new THREE.TextureLoader().load("/smoke_01.png", (tex) => {
      this.smokeTexture = tex;
    });
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  createCloud(x: number, z: number, radius: number, durationMs: number): void {
    const center = new THREE.Vector3(x, 1.5, z);
    const particles: SmokeParticle[] = [];
    const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: 0x999999,
        map: this.smokeTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      mat.userData.outlineParameters = { visible: false };

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.copy(center);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.scene.add(mesh);

      particles.push({
        mesh,
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * radius * 2,
          (Math.random() - 0.3) * radius * 1.2,
          (Math.random() - 0.5) * radius * 2,
        ),
        spinSpeed: (Math.random() - 0.5) * 0.3,
      });
    }

    this.clouds.push({
      particles,
      center,
      targetRadius: radius,
      lifetime: 0,
      maxLifetime: durationMs,
      baseOpacity: 0.6,
    });
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i];
      cloud.lifetime += deltaMs;

      // Expand: particles move from center to their target offset
      const expandT = Math.min(1, cloud.lifetime / 1000);

      // Fade in over first 600ms, fade out over last 2s
      let opacity = cloud.baseOpacity;
      if (cloud.lifetime < 600) {
        opacity *= cloud.lifetime / 600;
      }
      const fadeStart = cloud.maxLifetime - 2000;
      if (cloud.lifetime > fadeStart) {
        opacity *= 1 - (cloud.lifetime - fadeStart) / 2000;
      }

      for (const p of cloud.particles) {
        // Position: lerp from center to center + offset
        p.mesh.position.set(
          cloud.center.x + p.offset.x * expandT,
          cloud.center.y + p.offset.y * expandT,
          cloud.center.z + p.offset.z * expandT,
        );

        // Billboard: face camera, then restore Z rotation for spin
        if (this.camera) {
          const z = p.mesh.rotation.z;
          p.mesh.lookAt(this.camera.position);
          p.mesh.rotation.z = z + dt * p.spinSpeed;
        }

        // Scale up as cloud expands
        const scale = 0.4 + expandT * 0.6;
        p.mesh.scale.setScalar(scale);

        (p.mesh.material as THREE.MeshLambertMaterial).opacity = opacity;
      }

      // Cleanup
      if (cloud.lifetime >= cloud.maxLifetime) {
        for (const p of cloud.particles) {
          this.scene.remove(p.mesh);
          (p.mesh.material as THREE.Material).dispose();
        }
        // Dispose per-cloud geometry
        cloud.particles[0]?.mesh.geometry.dispose();
        this.clouds.splice(i, 1);
      }
    }
  }
}
