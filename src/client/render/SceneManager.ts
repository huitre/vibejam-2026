import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { ThirdPersonCamera } from "./ThirdPersonCamera.js";

export class SceneManager {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private outlineEffect!: OutlineEffect;
  private thirdPersonCamera!: ThirdPersonCamera;
  private clock = new THREE.Clock();

  initialize(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Moonlight only — 30% brightness on lit surfaces
    // Ambient fills shadow areas slightly so geometry is readable
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(ambient);

    // Directional moonlight — cool blue, high angle
    const moon = new THREE.DirectionalLight(0xaabbdd, 0.22);
    moon.position.set(30, 60, 40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -50;
    moon.shadow.camera.right = 50;
    moon.shadow.camera.top = 60;
    moon.shadow.camera.bottom = -60;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 150;
    moon.shadow.bias = -0.002;
    this.scene.add(moon);

    this.outlineEffect = new OutlineEffect(this.renderer, {
      defaultThickness: 0.003,
      defaultColor: [0, 0, 0],
      defaultAlpha: 1.0,
    });

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
      this.outlineEffect.render(this.scene, this.thirdPersonCamera.getCamera());
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
