import * as THREE from "three";

const SPIKE_COUNT = 8;
const SPIKE_HEIGHT = 0.3;
const SPIKE_RADIUS = 0.06;
const RING_INNER_RADIUS = 0.3;
const FADE_START_MS = 3000; // fade over last 3 seconds

interface CaltropInstance {
  group: THREE.Group;
  lifetimeMs: number;
  elapsedMs: number;
  durationMs: number;
}

export class CaltropVisual {
  private scene: THREE.Scene;
  private instances: CaltropInstance[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createCaltrops(x: number, z: number, radius: number, durationMs: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0.01, z);

    const spikeGeo = new THREE.ConeGeometry(SPIKE_RADIUS, SPIKE_HEIGHT, 4);
    const spikeMat = new THREE.MeshToonMaterial({ color: 0x888888 });

    for (let i = 0; i < SPIKE_COUNT; i++) {
      const angle = (i / SPIKE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = RING_INNER_RADIUS + Math.random() * (radius - RING_INNER_RADIUS);
      const spike = new THREE.Mesh(spikeGeo, spikeMat.clone());
      spike.position.set(
        Math.cos(angle) * dist,
        SPIKE_HEIGHT * 0.5,
        Math.sin(angle) * dist,
      );
      spike.castShadow = true;
      group.add(spike);
    }

    // Faint ground ring
    const ringGeo = new THREE.RingGeometry(radius - 0.1, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    this.scene.add(group);
    this.instances.push({ group, lifetimeMs: 0, elapsedMs: 0, durationMs });
  }

  update(deltaMs: number): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      inst.elapsedMs += deltaMs;

      const remaining = inst.durationMs - inst.elapsedMs;

      if (remaining <= 0) {
        // Cleanup
        this.scene.remove(inst.group);
        inst.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
        this.instances.splice(i, 1);
        continue;
      }

      // Fade out over last FADE_START_MS
      if (remaining < FADE_START_MS) {
        const alpha = remaining / FADE_START_MS;
        inst.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material;
            if (mat instanceof THREE.Material) {
              mat.transparent = true;
              mat.opacity = alpha;
            }
          }
        });
      }
    }
  }
}
