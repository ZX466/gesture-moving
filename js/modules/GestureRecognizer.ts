/**
 * @fileoverview MediaPipe-based hand gesture recognition with non-blocking
 * fire-and-forget frame processing to prevent desktop freezing.
 */

declare const Hands: {
  new (opts?: { locateFile?: (f: string) => string }): Hands;
};
declare interface Hands {
  setOptions(opts: object): void;
  onResults(cb: (r: HandResults) => void): void;
  send(opts: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
import { AppConfig } from './Config.js';
import type {
  Landmark2D as Landmark2D,
  HandResults as HandResults,

  FingerBend,
  GestureChangeCallback,
  HandPositionCallback,
  CameraStatusCallback,
  GestureChangePayload,
  GestureHistory,
  GestureRecognizerConfig,
  GestureRecognizerState,
  GestureType,
} from '../types.js';

export class GestureRecognizer {
  private readonly config: Required<GestureRecognizerConfig>;
  public readonly state: GestureRecognizerState;
  public mpHands: Hands | null = null;
  public videoElement: HTMLVideoElement | null | undefined;
  public cameraActive = false;
  private isSending = false;
  private animationFrameId: number | null = null;
  public isDestroyed = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private sendRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly gestureHistory: GestureHistory;
  private readonly listeners: {
    gestureChange: GestureChangeCallback[];
    handPosition: HandPositionCallback[];
    cameraStatus: CameraStatusCallback[];
  };
  public modelReady = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 30;
  private lastProcessTime = 0;
  private readonly minProcessInterval = 50;

  constructor(config: GestureRecognizerConfig = {}) {
    this.config = {
      swordPointAngleThreshold: config.swordPointAngleThreshold ?? 0.5,
      peaceAngleThreshold: config.peaceAngleThreshold ?? 0.4,
      thumbDistRatio: config.thumbDistRatio ?? 1.1,
      fingerBendThreshold: config.fingerBendThreshold ?? 0.04,
      palmVelocityThreshold: config.palmVelocityThreshold ?? 3.0,
      debounceFrames: config.debounceFrames ?? 3,
      hysteresisFrames: config.hysteresisFrames ?? 3,
      minGestureDuration: config.minGestureDuration ?? 150,
      recoveryDelay: config.recoveryDelay ?? 300,
    };

    this.state = {
      currentGesture: 'none',
      gestureFrames: 0,
      handPos: { x: 0.5, y: 0.5 },
      handVelocityX: 0,
      handVelocityY: 0,
      prevHandX: 0.5,
      prevHandY: 0.5,
      lastHandTime: 0,
      fingerTip3D: null,
      prevFingerTip3D: null,
      peaceTarget: null,
      targetHandRotation: 0,
      handRotation: 0,
    };

    this.mpHands = null;
    this.videoElement = null;

    this.gestureHistory = {
      frames: [],
      lastGestureTime: 0,
      stableGesture: 'none',
      pendingGesture: 'none',
      hysteresisCount: 0,
    };

    this.listeners = {
      gestureChange: [],
      handPosition: [],
      cameraStatus: [],
    };
  }

  async init(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;

    if (typeof Hands === 'undefined') {
      throw new Error('MediaPipe Hands library not loaded!');
    }

    this.mpHands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.mpHands.setOptions({
      maxNumHands: AppConfig.camera.maxNumHands,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.mpHands.onResults((results) => {
      if (!this.modelReady) {
        this.modelReady = true;
        console.log('[Gesture] Model loaded and ready');
      }
      this.onResults(results);
    });
    console.log('[Gesture] MediaPipe Hands initialized');
  }

  async startCamera(): Promise<void> {
    this.notifyCameraStatus('loading', '正在请求摄像头权限...');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      });
      console.log('[Gesture] Camera stream obtained:', stream.getVideoTracks()[0]?.label);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.notifyCameraStatus('inactive', '摄像头访问被拒绝: ' + msg);
      throw e;
    }

    if (!this.videoElement) throw new Error('Video element not initialized');

    this.videoElement.srcObject = stream;
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.setAttribute('autoplay', '');
    this.videoElement.setAttribute('muted', '');
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.autoplay = true;

    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = (): void => {
        if (resolved) return;
        resolved = true;
        this.cameraActive = true;
        this.notifyCameraStatus('active', '摄像头已启动 - 模型加载中...');
        setTimeout(() => this.processVideoFrames(), 1000);
        resolve();
      };

      this.videoElement!.onloadedmetadata = () => {
        console.log('[Gesture] Video metadata loaded, readyState=' + this.videoElement!.readyState);
        this.videoElement!.play().then(done).catch((e) => {
          console.warn('[Gesture] play() rejected:', (e as Error).message);
          done();
        });
      };

      this.videoElement!.onerror = (e) => {
        console.error('[Gesture] Video element error:', e);
        this.notifyCameraStatus('inactive', '视频元素错误');
      };

      setTimeout(() => {
        if (!resolved) {
          console.warn('[Gesture] Camera start timeout, forcing start');
          done();
        }
      }, 8000);
    });
  }

  stopCamera(): void {
    this.cameraActive = false;
    this.isSending = false;
    this.modelReady = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.sendRecoveryTimer !== null) {
      clearTimeout(this.sendRecoveryTimer);
      this.sendRecoveryTimer = null;
    }

    if (this.videoElement?.srcObject) {
      (this.videoElement.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }

    this.consecutiveErrors = 0;
    this.notifyCameraStatus('inactive', '摄像头已停止');
  }

  /**
   * Non-blocking video frame processing. Schedules next frame immediately
   * and fires send() without awaiting, preventing the animation loop from
   * freezing while MediaPipe processes a frame.
   */
  private processVideoFrames(): void {
    if (!this.cameraActive || this.isDestroyed) return;

    this.animationFrameId = requestAnimationFrame(() => this.processVideoFrames());

    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const now = performance.now();
    if (now - this.lastProcessTime < this.minProcessInterval) return;
    this.lastProcessTime = now;

    if (this.isSending) return;
    if (!this.mpHands) return;

    try {
      this.isSending = true;
      const sendPromise = this.mpHands.send({ image: this.videoElement });
      if (sendPromise && typeof sendPromise.then === 'function') {
        sendPromise.then(
          () => { this.isSending = false; },
          (err: unknown) => {
            this.isSending = false;
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
              console.warn('[Gesture] Too many errors, pausing processing');
              this.consecutiveErrors = 0;
              if (this.sendRecoveryTimer) clearTimeout(this.sendRecoveryTimer);
              this.sendRecoveryTimer = setTimeout(() => {
                this.sendRecoveryTimer = null;
              }, 2000);
            }
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Gesture] send() error:', msg);
          },
        );
      } else {
        this.isSending = false;
      }

      // Recovery timer: reset isSending if it appears stuck
      if (this.sendRecoveryTimer === null) {
        this.sendRecoveryTimer = setTimeout(() => {
          if (this.isSending) {
            console.warn('[Gesture] send() appears stuck, resetting flag');
            this.isSending = false;
          }
          this.sendRecoveryTimer = null;
        }, 5000);
      }
    } catch (e) {
      console.warn('[Gesture] send() error:', (e as Error).message);
      this.isSending = false;
    }
  }

  private onResults(results: HandResults): void {
    try {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        this.handleNoHand();
        return;
      }

      const lm = results.multiHandLandmarks[0];
      if (!this.validateLandmarks(lm, results)) return;

      this.updateHandPosition(lm);
      this.updateHandRotation(lm);
      this.updateFingerTips(lm);

      const raw = this.classifyGesture(lm);
      this.updateGestureHistory(raw, lm);

      const handSpeed = Math.sqrt(
        this.state.handVelocityX * this.state.handVelocityX +
        this.state.handVelocityY * this.state.handVelocityY,
      );
      if (handSpeed > this.config.palmVelocityThreshold * 1.5) return;

      this.notifyGestureChange({
        gesture: this.state.currentGesture,
        handPos: this.state.handPos,
        fingerTip3D: this.state.fingerTip3D ?? undefined,
        peaceTarget: this.state.peaceTarget ?? undefined,
        handOpenness: this.calculateHandOpenness(lm),
      });
    } catch (error) {
      console.error('Error in hand results processing:', error);
      this.handleError();
    }
  }

  private handleNoHand(): void {
    this.state.gestureFrames = 0;
    this.state.currentGesture = 'none';
    this.notifyGestureChange({ gesture: 'none' });
  }

  private handleError(): void {
    this.state.currentGesture = 'none';
    this.state.gestureFrames = 0;
    this.gestureHistory.stableGesture = 'none';
    this.gestureHistory.pendingGesture = 'none';
    this.gestureHistory.frames = [];
    this.notifyGestureChange({ gesture: 'none' });
  }

  validateLandmarks(lm: Landmark2D[], results: HandResults): boolean {
    if (!lm || lm.length < 21) return false;

    for (let i = 0; i < 21; i++) {
      if (!lm[i] || !Number.isFinite(lm[i].x) || !Number.isFinite(lm[i].y) || !Number.isFinite(lm[i].z)) {
        return false;
      }
    }

    if (results.multiHandedness && results.multiHandedness.length > 0) {
      if (results.multiHandedness[0].score < 0.4) return false;
    }

    return true;
  }

  private updateHandPosition(lm: Landmark2D[]): void {
    const palmX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    const palmY = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;

    this.state.handPos = { x: palmX, y: palmY };

    const now = performance.now() / 1000;
    const hDelta = Math.max(now - this.state.lastHandTime, 0.001);
    this.state.handVelocityX = (palmX - this.state.prevHandX) / hDelta;
    this.state.handVelocityY = (palmY - this.state.prevHandY) / hDelta;
    this.state.prevHandX = palmX;
    this.state.prevHandY = palmY;
    this.state.lastHandTime = now;

    this.listeners.handPosition.forEach((cb) => cb(this.state.handPos));
  }

  private updateHandRotation(lm: Landmark2D[]): void {
    const dx = lm[9].x - lm[0].x;
    const dy = lm[9].y - lm[0].y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.state.targetHandRotation = Math.atan2(dy, dx);
    }
    this.state.handRotation +=
      (this.state.targetHandRotation - this.state.handRotation) * 0.1;
  }

  private updateFingerTips(lm: Landmark2D[]): void {
    const newTip3D = this.handTo3D(lm[8].x, lm[8].y);

    if (!this.state.fingerTip3D) {
      this.state.fingerTip3D = new THREE.Vector3(0, 2, 0);
      this.state.prevFingerTip3D = new THREE.Vector3(0, 2, 0);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.state.prevFingerTip3D as any).copy(this.state.fingerTip3D);
    this.state.fingerTip3D = newTip3D;

    this.state.peaceTarget = this.handTo3D(
      (lm[8].x + lm[12].x) / 2,
      (lm[8].y + lm[12].y) / 2,
    );
  }

  private updateGestureHistory(raw: GestureType, _lm: Landmark2D[]): void {
    const nowMs = performance.now();

    if (raw !== 'unknown') {
      if (this.gestureHistory.pendingGesture !== raw) {
        this.gestureHistory.pendingGesture = raw;
        this.gestureHistory.frames = [raw];
        this.gestureHistory.lastGestureTime = nowMs;
      } else {
        this.gestureHistory.frames.push(raw);
        if (this.gestureHistory.frames.length > this.config.debounceFrames * 2) {
          this.gestureHistory.frames.shift();
        }
      }

      const recentFrames = this.gestureHistory.frames.slice(-this.config.debounceFrames);
      let allSame = true;
      for (let i = 1; i < recentFrames.length; i++) {
        if (recentFrames[i] !== raw) { allSame = false; break; }
      }
      const isStable = allSame && recentFrames.length >= Math.max(2, this.config.debounceFrames - 2);
      const isLongEnough = nowMs - this.gestureHistory.lastGestureTime >= 150;

      if (isStable && isLongEnough && this.gestureHistory.stableGesture !== raw) {
        this.gestureHistory.stableGesture = raw;
        this.state.currentGesture = raw;
        this.gestureHistory.hysteresisCount = 0;
      }
    } else {
      if (nowMs - this.gestureHistory.lastGestureTime > this.config.recoveryDelay) {
        this.gestureHistory.stableGesture = 'none';
        this.gestureHistory.pendingGesture = 'none';
        this.gestureHistory.frames = [];
      }
    }
  }

  classifyGesture(lm: Landmark2D[]): GestureType {
    const fs = this.getFingerStates(lm);
    const indexExt = fs[1];
    const middleExt = fs[2];
    const ringExt = fs[3];
    const pinkyExt = fs[4];
    const thumbExt = fs[0];

    if (indexExt && !middleExt && !ringExt && !pinkyExt) return 'sword_point';
    if (indexExt && middleExt && !ringExt && !pinkyExt) return 'peace';
    const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
    if (extendedCount >= 3 && indexExt && middleExt) return 'open_palm';
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) return 'fist';

    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      if (lm[4].y < lm[3].y - 0.03) return 'thumb_up';
    }

    return 'unknown';
  }

  getFingerStates(lm: Landmark2D[]): [boolean, boolean, boolean, boolean, boolean] {
    if (!lm || lm.length < 21) return [false, false, false, false, false];

    return [
      this.isThumbExtended(lm),
      this.isFingerExtended(lm, 8, 6, 5),
      this.isFingerExtended(lm, 12, 10, 9),
      this.isFingerExtended(lm, 16, 14, 13),
      this.isFingerExtended(lm, 20, 18, 17),
    ];
  }

  isThumbExtended(lm: Landmark2D[]): boolean {
    const tipToWrist = this.dist2d(lm[4], lm[0]);
    const ipToWrist = this.dist2d(lm[3], lm[0]);
    return tipToWrist > ipToWrist * 1.1;
  }

  isFingerExtended(lm: Landmark2D[], tipIdx: number, pipIdx: number, mcpIdx: number): boolean {
    const tipToWrist = this.dist2d(lm[tipIdx], lm[0]);
    const pipToWrist = this.dist2d(lm[pipIdx], lm[0]);
    const mcpToWrist = this.dist2d(lm[mcpIdx], lm[0]);
    const isExtended = tipToWrist > pipToWrist && pipToWrist > mcpToWrist * 0.9;

    const tipToPip = this.dist2d(lm[tipIdx], lm[pipIdx]);
    const pipToMcp = this.dist2d(lm[pipIdx], lm[mcpIdx]);
    const straightRatio = tipToPip / (pipToMcp || 0.01);

    return isExtended || straightRatio > 0.8;
  }

  calculateHandOpenness(lm: Landmark2D[]): number {
    const pIdx = [0, 5, 9, 13, 17];
    let cx = 0, cy = 0, cz = 0;
    for (const i of pIdx) {
      cx += lm[i].x;
      cy += lm[i].y;
      cz += (lm[i].z || 0);
    }
    const palmCenter: Landmark2D = {
      x: cx / pIdx.length,
      y: cy / pIdx.length,
      z: cz / pIdx.length,
    };

    const fingerTips = [4, 8, 12, 16, 20];
    let totalDist = 0;
    let maxDist = 0;
    for (const tipIdx of fingerTips) {
      const dist = this.dist3d(lm[tipIdx], palmCenter);
      totalDist += dist;
      if (dist > maxDist) maxDist = dist;
    }

    return Math.min(1, Math.max(0, totalDist / (maxDist * 5)));
  }

  private handTo3D(hx: number, hy: number): THREE.Vector3 {
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
      return new THREE.Vector3(0, 2, 0);
    }
    const vh = 2 * Math.tan(Math.PI / 6) * 10;
    const vw = vh * (window.innerWidth / (window.innerHeight || 1));
    return new THREE.Vector3(
      (hx - 0.5) * vw * 0.8,
      -(hy - 0.5) * vh * 0.8,
      0,
    );
  }

  dist2d(a: Landmark2D, b: Landmark2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  dist3d(a: Landmark2D, b: Landmark2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  on(event: 'gestureChange' | 'handPosition' | 'cameraStatus', callback: unknown): void {
    if (this.listeners[event]) {
      (this.listeners[event] as unknown[]).push(callback);
    }
  }

  off(event: 'gestureChange' | 'handPosition' | 'cameraStatus', callback: unknown): void {
    if (this.listeners[event]) {
      (this.listeners[event] as unknown[]) = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
  }

  private notifyGestureChange(payload: GestureChangePayload): void {
    this.listeners.gestureChange.forEach((cb) => cb(payload));
  }

  private notifyCameraStatus(status: string, message: string): void {
    this.listeners.cameraStatus.forEach((cb) => cb({ status, message }));
  }

  getState(): Readonly<GestureRecognizerState> {
    const s = this.state;
    return {
      currentGesture: s.currentGesture,
      gestureFrames: s.gestureFrames,
      handPos: s.handPos,
      handVelocityX: s.handVelocityX,
      handVelocityY: s.handVelocityY,
      prevHandX: s.prevHandX,
      prevHandY: s.prevHandY,
      lastHandTime: s.lastHandTime,
      fingerTip3D: s.fingerTip3D,
      prevFingerTip3D: s.prevFingerTip3D,
      peaceTarget: s.peaceTarget,
      targetHandRotation: s.targetHandRotation,
      handRotation: s.handRotation,
    };
  }

  isCameraActive(): boolean {
    return this.cameraActive;
  }

  updateSensitivity(sensitivity: number): void {
    const base = AppConfig.gesture;
    this.config.debounceFrames = Math.max(1, Math.round(base.debounceFrames / sensitivity));
    this.config.minGestureDuration = Math.max(50, Math.round(base.minGestureDuration / sensitivity));
    this.config.palmVelocityThreshold = base.palmVelocityThreshold * sensitivity;
    this.config.hysteresisFrames = Math.max(1, Math.round(base.hysteresisFrames / sensitivity));
  }

  dispose(): void {
    this.isDestroyed = true;
    this.stopCamera();
    if (this.mpHands) {
      try { this.mpHands.close(); } catch { /* ignore */ }
    }
    const keys = Object.keys(this.listeners) as Array<keyof typeof this.listeners>;
    for (const key of keys) {
      (this.listeners[key] as unknown[]) = [];
    }
  }
}

export default GestureRecognizer;
