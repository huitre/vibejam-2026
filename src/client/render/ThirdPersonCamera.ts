import * as THREE from "three";

/**
 * Third-person camera inspired by SimonDev's ThirdPersonCamera tutorial.
 * Mouse orbit via pointer lock, smooth lerp follow, ideal offset/lookat.
 */
export class ThirdPersonCamera {
  private camera: THREE.PerspectiveCamera;
  private currentPosition = new THREE.Vector3();
  private currentLookat = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private phi = 0;
  private theta = 0.3;
  private mouseXDelta = 0;
  private mouseYDelta = 0;
  private firstFollow = true;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    this.camera.position.set(40, 10, -10);

    domElement.addEventListener("mousemove", (e: MouseEvent) => {
      if (document.pointerLockElement === domElement) {
        this.mouseXDelta += e.movementX;
        this.mouseYDelta += e.movementY;
      }
    });

    domElement.addEventListener("click", () => {
      if (document.pointerLockElement !== domElement) {
        domElement.requestPointerLock();
      }
    });
  }

  update(deltaSec: number): void {
    // Accumulate mouse rotation
    const xh = this.mouseXDelta / window.innerWidth;
    const yh = this.mouseYDelta / window.innerHeight;
    this.phi += -xh * 8;
    this.theta = Math.min(Math.max(this.theta + yh * 5, 0.05), 1.3);
    this.mouseXDelta = 0;
    this.mouseYDelta = 0;

    const idealOffset = this.calculateIdealOffset();
    const idealLookat = this.calculateIdealLookat();

    // Frame-rate independent lerp (SimonDev's approach)
    const t = 1.0 - Math.pow(0.001, deltaSec);

    if (this.firstFollow && this.targetPos.lengthSq() > 0) {
      this.currentPosition.copy(idealOffset);
      this.currentLookat.copy(idealLookat);
      this.firstFollow = false;
    } else {
      this.currentPosition.lerp(idealOffset, t);
      this.currentLookat.lerp(idealLookat, t);
    }

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }

  private calculateIdealOffset(): THREE.Vector3 {
    const distance = 14;
    // Camera behind and above the player, controlled by theta (pitch)
    const idealOffset = new THREE.Vector3(
      0,
      2 + Math.sin(this.theta) * distance,
      -Math.cos(this.theta) * distance,
    );
    // Rotate around Y by phi (yaw orbit)
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi);
    idealOffset.applyQuaternion(q);
    idealOffset.add(this.targetPos);
    return idealOffset;
  }

  private calculateIdealLookat(): THREE.Vector3 {
    const idealLookat = new THREE.Vector3(0, 1.5, 0);
    idealLookat.add(this.targetPos);
    return idealLookat;
  }

  followTarget(target: THREE.Vector3): void {
    this.targetPos.copy(target);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getYaw(): number {
    return this.phi;
  }

  updateAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
