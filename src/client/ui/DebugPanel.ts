import GUI from "lil-gui";
import { REST_POS, REST_ROT, SWING_A, SWING_B } from "../render/WeaponRenderer.js";
import type { WeaponRenderer } from "../render/WeaponRenderer.js";
import type { InputSender } from "../network/InputSender.js";

export class DebugPanel {
  private gui: GUI;

  constructor(weaponRenderer: WeaponRenderer, inputSender: InputSender) {
    this.gui = new GUI({ title: "Debug" });

    // ── Collisions ──────────────────────────────────────────────────────────
    const collisions = this.gui.addFolder("Collisions");
    const collisionState = { noclip: false };
    collisions.add(collisionState, "noclip").onChange(() => {
      inputSender.sendDebugNoclip();
    });

    // ── Katana Rest Pose ──────────────────────────────────────────────────
    const restFolder = this.gui.addFolder("Katana Rest Pose");
    const restPosProxy = { x: REST_POS[0], y: REST_POS[1], z: REST_POS[2] };
    const restRotProxy = { rx: REST_ROT[0], ry: REST_ROT[1], rz: REST_ROT[2] };
    const updateRest = () => {
      REST_POS[0] = restPosProxy.x;
      REST_POS[1] = restPosProxy.y;
      REST_POS[2] = restPosProxy.z;
      REST_ROT[0] = restRotProxy.rx;
      REST_ROT[1] = restRotProxy.ry;
      REST_ROT[2] = restRotProxy.rz;
      weaponRenderer.refreshRestPose();
    };
    const posFolder = restFolder.addFolder("Position");
    posFolder.add(restPosProxy, "x", -2, 2, 0.01).onChange(updateRest);
    posFolder.add(restPosProxy, "y", -2, 2, 0.01).onChange(updateRest);
    posFolder.add(restPosProxy, "z", -2, 2, 0.01).onChange(updateRest);
    const rotFolder = restFolder.addFolder("Rotation");
    rotFolder.add(restRotProxy, "rx", -Math.PI, Math.PI, 0.01).onChange(updateRest);
    rotFolder.add(restRotProxy, "ry", -Math.PI, Math.PI, 0.01).onChange(updateRest);
    rotFolder.add(restRotProxy, "rz", -Math.PI, Math.PI, 0.01).onChange(updateRest);

    // ── Swing A keyframes (indices 1-3: wind-up, mid, follow-through) ─────
    const swingAFolder = this.gui.addFolder("Swing A");
    this.addKeyframeFolder(swingAFolder, "Wind-up", SWING_A[1]);
    this.addKeyframeFolder(swingAFolder, "Mid", SWING_A[2]);
    this.addKeyframeFolder(swingAFolder, "Follow-through", SWING_A[3]);
    swingAFolder.close();

    // ── Swing B keyframes (indices 1-3) ───────────────────────────────────
    const swingBFolder = this.gui.addFolder("Swing B");
    this.addKeyframeFolder(swingBFolder, "Wind-up", SWING_B[1]);
    this.addKeyframeFolder(swingBFolder, "Mid", SWING_B[2]);
    this.addKeyframeFolder(swingBFolder, "Follow-through", SWING_B[3]);
    swingBFolder.close();
  }

  private addKeyframeFolder(parent: GUI, name: string, kf: { pos: number[]; rot: number[] }): void {
    const folder = parent.addFolder(name);
    const posProxy = { x: kf.pos[0], y: kf.pos[1], z: kf.pos[2] };
    const updatePos = () => {
      kf.pos[0] = posProxy.x;
      kf.pos[1] = posProxy.y;
      kf.pos[2] = posProxy.z;
    };
    const pf = folder.addFolder("pos");
    pf.add(posProxy, "x", -2, 2, 0.01).onChange(updatePos);
    pf.add(posProxy, "y", -2, 2, 0.01).onChange(updatePos);
    pf.add(posProxy, "z", -2, 2, 0.01).onChange(updatePos);

    const rotProxy = { rx: kf.rot[0], ry: kf.rot[1], rz: kf.rot[2] };
    const updateRot = () => {
      kf.rot[0] = rotProxy.rx;
      kf.rot[1] = rotProxy.ry;
      kf.rot[2] = rotProxy.rz;
    };
    const rf = folder.addFolder("rot");
    rf.add(rotProxy, "rx", -Math.PI, Math.PI, 0.01).onChange(updateRot);
    rf.add(rotProxy, "ry", -Math.PI, Math.PI, 0.01).onChange(updateRot);
    rf.add(rotProxy, "rz", -Math.PI, Math.PI, 0.01).onChange(updateRot);

    folder.close();
  }
}
