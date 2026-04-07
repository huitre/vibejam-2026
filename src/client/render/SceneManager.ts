import * as THREE from "three";
import { ThirdPersonCamera } from "./ThirdPersonCamera.js";

export class SceneManager {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private thirdPersonCamera!: ThirdPersonCamera;
  private clock = new THREE.Clock();

  initialize(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    // Moonlight only — 30% brightness on lit surfaces
    // Ambient fills shadow areas slightly so geometry is readable
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(ambient);

    // Directional moonlight — cool blue, high angle
    const moon = new THREE.DirectionalLight(0xaabbdd, 0.22);
    moon.position.set(30, 60, 40);
    this.scene.add(moon);

    this.thirdPersonCamera = new ThirdPersonCamera(canvas);

    window.addEventListener("resize", () => {
      this.thirdPersonCamera.updateAspect(window.innerWidth / window.innerHeight);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  startLoop(onUpdate: (dt: number) => void): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      const deltaSec = this.clock.getDelta();
      this.thirdPersonCamera.update(deltaSec);
      onUpdate(deltaSec * 1000);
      this.renderer.render(this.scene, this.thirdPersonCamera.getCamera());
    };
    loop();
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getThirdPersonCamera(): ThirdPersonCamera {
    return this.thirdPersonCamera;
  }
}
