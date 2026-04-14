import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { ThirdPersonCamera } from "./ThirdPersonCamera.js";
import { LIGHTING } from "../../shared/constants.js";

export class SceneManager {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private outlineEffect!: OutlineEffect;
  private thirdPersonCamera!: ThirdPersonCamera;
  private clock = new THREE.Clock();
  private statsEl!: HTMLDivElement;

  initialize(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ambient fills shadow areas slightly so geometry is readable
    const ambient = new THREE.AmbientLight(0xffffff, LIGHTING.AMBIENT_INTENSITY);
    this.scene.add(ambient);

    // Directional moonlight — cool blue, high angle
    const moon = new THREE.DirectionalLight(0xaabbdd, LIGHTING.MOON_INTENSITY);
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

    // Triangle counter overlay
    this.statsEl = document.createElement("div");
    this.statsEl.style.cssText =
      "position:fixed;top:4px;right:4px;padding:4px 8px;background:rgba(0,0,0,0.7);" +
      "color:#0f0;font:12px monospace;z-index:100;pointer-events:none;";
    document.body.appendChild(this.statsEl);

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

      const info = this.renderer.info;
      this.statsEl.textContent =
        `Tris: ${info.render.triangles.toLocaleString()} | Draw: ${info.render.calls} | Geo: ${info.memory.geometries}`;
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
