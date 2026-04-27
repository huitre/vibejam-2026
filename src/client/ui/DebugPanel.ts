import GUI from "lil-gui";
import {
  REST_POS, REST_ROT, SWING_A, SWING_B,
  LANCE_REST_POS, LANCE_REST_ROT, LANCE_SWING_A, LANCE_SWING_B,
  SWING_CONFIG,
} from "../render/WeaponRenderer.js";
import type { EasingName } from "../render/WeaponRenderer.js";
import type { WeaponRenderer } from "../render/WeaponRenderer.js";
import type { InputSender } from "../network/InputSender.js";

export class DebugPanel {
  private gui: GUI;
  private weaponRenderer: WeaponRenderer;
  private localSessionId: string;
  /** Which keyframe is currently being live-edited (null = none) */
  private activePreview: { pos: number[]; rot: number[] } | null = null;
  /** Timeline scrubber state */
  private timelineState = { t: 0, swing: "A" as "A" | "B" | "Lance A" | "Lance B" };
  private timelineActive = false;

  constructor(weaponRenderer: WeaponRenderer, inputSender: InputSender, localSessionId: string) {
    this.gui = new GUI({ title: "Debug" });
    this.weaponRenderer = weaponRenderer;
    this.localSessionId = localSessionId;

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

    // ── Swing Config ──────────────────────────────────────────────────────
    const swingConfigFolder = this.gui.addFolder("Swing Config");
    swingConfigFolder.add(SWING_CONFIG, "durationMs", 100, 1500, 10).name("Duration (ms)");
    swingConfigFolder.add(SWING_CONFIG, "easing", [
      "linear", "smoothstep", "easeInQuad", "easeOutQuad", "easeInOutCubic", "easeOutBack",
    ] as EasingName[]).name("Easing");

    // ── Lance Rest Pose ──────────────────────────────────────────────────
    const lanceRestFolder = this.gui.addFolder("Lance Rest Pose");
    const lanceRestPosProxy = { x: LANCE_REST_POS[0], y: LANCE_REST_POS[1], z: LANCE_REST_POS[2] };
    const lanceRestRotProxy = { rx: LANCE_REST_ROT[0], ry: LANCE_REST_ROT[1], rz: LANCE_REST_ROT[2] };
    const updateLanceRest = () => {
      LANCE_REST_POS[0] = lanceRestPosProxy.x;
      LANCE_REST_POS[1] = lanceRestPosProxy.y;
      LANCE_REST_POS[2] = lanceRestPosProxy.z;
      LANCE_REST_ROT[0] = lanceRestRotProxy.rx;
      LANCE_REST_ROT[1] = lanceRestRotProxy.ry;
      LANCE_REST_ROT[2] = lanceRestRotProxy.rz;
      weaponRenderer.refreshRestPose();
    };
    const lPosFolder = lanceRestFolder.addFolder("Position");
    lPosFolder.add(lanceRestPosProxy, "x", -2, 2, 0.01).onChange(updateLanceRest);
    lPosFolder.add(lanceRestPosProxy, "y", -2, 2, 0.01).onChange(updateLanceRest);
    lPosFolder.add(lanceRestPosProxy, "z", -2, 2, 0.01).onChange(updateLanceRest);
    const lRotFolder = lanceRestFolder.addFolder("Rotation");
    lRotFolder.add(lanceRestRotProxy, "rx", -Math.PI, Math.PI, 0.01).onChange(updateLanceRest);
    lRotFolder.add(lanceRestRotProxy, "ry", -Math.PI, Math.PI, 0.01).onChange(updateLanceRest);
    lRotFolder.add(lanceRestRotProxy, "rz", -Math.PI, Math.PI, 0.01).onChange(updateLanceRest);
    lanceRestFolder.close();

    // ── Timeline Scrubber ─────────────────────────────────────────────────
    const timelineFolder = this.gui.addFolder("Timeline");
    timelineFolder.add(this.timelineState, "swing", ["A", "B", "Lance A", "Lance B"]).name("Swing").onChange(() => {
      this.scrubTimeline();
    });
    timelineFolder.add(this.timelineState, "t", 0, 1, 0.005).name("Time").onChange(() => {
      this.scrubTimeline();
    });
    timelineFolder.add({ play: () => this.playCurrentSwing() }, "play").name("Play Animation");
    timelineFolder.add({ reset: () => this.exitPreviewMode() }, "reset").name("Reset to Rest");

    // ── Swing A keyframes ───────────────────────────────────────────────
    const swingAFolder = this.gui.addFolder("Swing A");
    this.addKeyframeFolder(swingAFolder, "Wind-up (t=0.15)", SWING_A[1]);
    this.addKeyframeFolder(swingAFolder, "Hit (t=0.8)", SWING_A[2]);
    if (SWING_A.length > 3) {
      this.addKeyframeFolder(swingAFolder, "Return (t=1.0)", SWING_A[3]);
    }
    swingAFolder.close();

    // ── Swing B keyframes ───────────────────────────────────────────────
    const swingBFolder = this.gui.addFolder("Swing B");
    this.addKeyframeFolder(swingBFolder, "Wind-up (t=0.15)", SWING_B[1]);
    this.addKeyframeFolder(swingBFolder, "Hit (t=0.8)", SWING_B[2]);
    if (SWING_B.length > 3) {
      this.addKeyframeFolder(swingBFolder, "Return (t=1.0)", SWING_B[3]);
    }
    swingBFolder.close();

    // ── Lance Swing A keyframes ──────────────────────────────────────────
    const lanceAFolder = this.gui.addFolder("Lance Swing A");
    this.addKeyframeFolder(lanceAFolder, "Wind-up (t=0.15)", LANCE_SWING_A[1]);
    this.addKeyframeFolder(lanceAFolder, "Hit (t=0.8)", LANCE_SWING_A[2]);
    if (LANCE_SWING_A.length > 3) {
      this.addKeyframeFolder(lanceAFolder, "Return (t=1.0)", LANCE_SWING_A[3]);
    }
    lanceAFolder.close();

    // ── Lance Swing B keyframes ──────────────────────────────────────────
    const lanceBFolder = this.gui.addFolder("Lance Swing B");
    this.addKeyframeFolder(lanceBFolder, "Wind-up (t=0.15)", LANCE_SWING_B[1]);
    this.addKeyframeFolder(lanceBFolder, "Hit (t=0.8)", LANCE_SWING_B[2]);
    if (LANCE_SWING_B.length > 3) {
      this.addKeyframeFolder(lanceBFolder, "Return (t=1.0)", LANCE_SWING_B[3]);
    }
    lanceBFolder.close();

    // ── Export ───────────────────────────────────────────────────────────
    const exportFolder = this.gui.addFolder("Export");
    exportFolder.add({ copy: () => this.exportToClipboard() }, "copy").name("Copy to Clipboard");
  }

  private addKeyframeFolder(parent: GUI, name: string, kf: { pos: number[]; rot: number[] }): void {
    const folder = parent.addFolder(name);

    const posProxy = { x: kf.pos[0], y: kf.pos[1], z: kf.pos[2] };
    const rotProxy = { rx: kf.rot[0], ry: kf.rot[1], rz: kf.rot[2] };

    const sync = () => {
      kf.pos[0] = posProxy.x;
      kf.pos[1] = posProxy.y;
      kf.pos[2] = posProxy.z;
      kf.rot[0] = rotProxy.rx;
      kf.rot[1] = rotProxy.ry;
      kf.rot[2] = rotProxy.rz;
      // Live update if this keyframe is being previewed
      if (this.activePreview === kf) {
        this.weaponRenderer.previewPose(this.localSessionId, kf.pos, kf.rot);
      }
      // Also update if timeline scrubber is active
      if (this.timelineActive) {
        this.scrubTimeline();
      }
    };

    const pf = folder.addFolder("pos");
    pf.add(posProxy, "x", -2, 2, 0.01).onChange(sync);
    pf.add(posProxy, "y", -2, 2, 0.01).onChange(sync);
    pf.add(posProxy, "z", -2, 2, 0.01).onChange(sync);

    const rf = folder.addFolder("rot");
    rf.add(rotProxy, "rx", -Math.PI, Math.PI, 0.01).onChange(sync);
    rf.add(rotProxy, "ry", -Math.PI, Math.PI, 0.01).onChange(sync);
    rf.add(rotProxy, "rz", -Math.PI, Math.PI, 0.01).onChange(sync);

    // Live Edit: toggle that locks preview to this keyframe
    folder.add(
      {
        liveEdit: () => {
          if (this.activePreview === kf) {
            // Toggle off — return to rest
            this.exitPreviewMode();
          } else {
            this.activePreview = kf;
            this.timelineActive = false;
            this.weaponRenderer.previewPose(this.localSessionId, kf.pos, kf.rot);
          }
        },
      },
      "liveEdit",
    ).name("> Live Edit");

    folder.close();
  }

  /** Scrub timeline: interpolate between keyframes at time t */
  private scrubTimeline(): void {
    this.timelineActive = true;
    this.activePreview = null;
    const swingMap: Record<string, typeof SWING_A> = {
      "A": SWING_A, "B": SWING_B,
      "Lance A": LANCE_SWING_A, "Lance B": LANCE_SWING_B,
    };
    const keyframes = swingMap[this.timelineState.swing] ?? SWING_A;
    const t = this.timelineState.t;

    // Find surrounding keyframes
    let i = 0;
    for (; i < keyframes.length - 1; i++) {
      if (t <= keyframes[i + 1].t) break;
    }
    const kf0 = keyframes[i];
    const kf1 = keyframes[Math.min(i + 1, keyframes.length - 1)];

    // Linear interpolation for scrubbing (easing only for playback)
    const range = kf1.t - kf0.t;
    const localT = range > 0 ? Math.max(0, Math.min(1, (t - kf0.t) / range)) : 0;

    const pos = [
      kf0.pos[0] + (kf1.pos[0] - kf0.pos[0]) * localT,
      kf0.pos[1] + (kf1.pos[1] - kf0.pos[1]) * localT,
      kf0.pos[2] + (kf1.pos[2] - kf0.pos[2]) * localT,
    ];
    const rot = [
      kf0.rot[0] + (kf1.rot[0] - kf0.rot[0]) * localT,
      kf0.rot[1] + (kf1.rot[1] - kf0.rot[1]) * localT,
      kf0.rot[2] + (kf1.rot[2] - kf0.rot[2]) * localT,
    ];

    this.weaponRenderer.previewPose(this.localSessionId, pos, rot);
  }

  private playCurrentSwing(): void {
    this.exitPreviewMode();
    const swing = this.timelineState.swing;
    // Map "Lance A" → "A", "Lance B" → "B" (playSwingByType uses the weapon's own keyframes)
    const type = swing.includes("A") ? "A" : "B";
    this.weaponRenderer.playSwingByType(this.localSessionId, type);
  }

  private exitPreviewMode(): void {
    this.activePreview = null;
    this.timelineActive = false;
    this.weaponRenderer.refreshRestPose(this.localSessionId);
  }

  private exportToClipboard(): void {
    const fmt = (arr: number[]) => `[${arr.map((v) => v.toFixed(2)).join(", ")}]`;
    const fmtKf = (kf: { t: number; pos: number[]; rot: number[] }) =>
      `  { t: ${kf.t.toFixed(2)}, pos: ${fmt(kf.pos)}, rot: ${fmt(kf.rot)} },`;

    const lines = [
      `export const REST_POS = ${fmt(REST_POS)};`,
      `export const REST_ROT = ${fmt(REST_ROT)};`,
      ``,
      `export const SWING_A: Keyframe[] = [`,
      ...SWING_A.map(fmtKf),
      `];`,
      ``,
      `export const SWING_B: Keyframe[] = [`,
      ...SWING_B.map(fmtKf),
      `];`,
      ``,
      `export const LANCE_REST_POS = ${fmt(LANCE_REST_POS)};`,
      `export const LANCE_REST_ROT = ${fmt(LANCE_REST_ROT)};`,
      ``,
      `export const LANCE_SWING_A: Keyframe[] = [`,
      ...LANCE_SWING_A.map(fmtKf),
      `];`,
      ``,
      `export const LANCE_SWING_B: Keyframe[] = [`,
      ...LANCE_SWING_B.map(fmtKf),
      `];`,
      ``,
      `// Duration: ${SWING_CONFIG.durationMs}ms, Easing: ${SWING_CONFIG.easing}`,
    ];

    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(
      () => console.log("[AnimEditor] Copied to clipboard:\n" + text),
      () => console.log("[AnimEditor] Export (copy failed):\n" + text),
    );
  }
}
