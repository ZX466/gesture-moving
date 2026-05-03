/**
 * @fileoverview MediaPipe-based hand gesture recognition.
 * Detects sword_point, peace, fist, open_palm, thumb_up gestures
 * from 21-landmark hand tracking data.
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
  HandPosition,
} from '../types.js';

export class GestureRecognizer {
  private readonly config: Required<GestureRecognizerConfig>;
  public readonly state: GestureRecognizerState;
  public mpHands: Hands | null = null;
  public videoElement: HTMLVideoElement | null | undefined;
  public cameraActive = false;
  public isProcessing = false;
  private animationFrameId: number | null = null;
  public isDestroyed = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly gestureHistory: GestureHistory;
  private readonly listeners: {
    gestureChange: GestureChangeCallback[];
    handPosition: HandPositionCallback[];
    cameraStatus: CameraStatusCallback[];
  };

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
      fingerTip3D: new THREE.Vector3(0, 2, 0),
      prevFingerTip3D: new THREE.Vector3(0, 2, 0),
      peaceTarget: new THREE.Vector3(0, 2, 0),
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
      modelComplexity: AppConfig.camera.modelComplexity,
      minDetectionConfidence: AppConfig.camera.minDetectionConfidence,
      minTrackingConfidence: AppConfig.camera.minTrackingConfidence,
    });

    this.mpHands.onResults((results) => this.onResults(results));
  }

  async startCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });

    if (!this.videoElement) throw new Error('Video element not initialized');

    this.videoElement.srcObject = stream;
    this.videoElement.setAttribute('playsinline', 'true');
    this.videoElement.setAttribute('autoplay', 'true');
    this.videoElement.setAttribute('muted', 'true');

    return new Promise<void>((resolve, reject) => {
      this.videoElement!.onloadedmetadata = () => {
        this.videoElement!.play().then(() => {
          this.cameraActive = true;
          this.notifyCameraStatus('active', '摄像头已启动 - 请展示手势');
          setTimeout(() => this.processVideoFrames(), 500);
          resolve();
        }).catch(reject);
      };
      this.videoElement!.onerror = (e) => {
        this.notifyCameraStatus('inactive', '摄像头访问失败');
        reject(e);
      };
    });
  }

  stopCamera(): void {
    this.cameraActive = false;
    this.isProcessing = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.videoElement?.srcObject) {
      (this.videoElement.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }

    this.notifyCameraStatus('inactive', '摄像头已停止');
  }

  async processVideoFrames(): Promise<void> {
    if (!this.cameraActive || !this.mpHands || this.isDestroyed) return;

    if (this.isProcessing) {
      this.animationFrameId = requestAnimationFrame(() => { void this.processVideoFrames(); });
      return;
    }

    if (!this.videoElement || this.videoElement.readyState < 2) {
      this.animationFrameId = requestAnimationFrame(() => { void this.processVideoFrames(); });
      return;
    }

    try {
      this.isProcessing = true;
      const SEND_TIMEOUT_MS = 3000;
      await Promise.race([
        this.mpHands.send({ image: this.videoElement }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('MediaPipe send timeout')), SEND_TIMEOUT_MS),
        ),
      ]);
      this.isProcessing = false;
    } catch (e) {
      console.warn('Error/timeout processing frame:', e);
      this.handleWasmError(e);
      this.isProcessing = false;
    }

    this.animationFrameId = requestAnimationFrame(() => { void this.processVideoFrames(); });
  }

  private wasmErrorCount = 0;
  private maxWasmErrors = 3;

  private handleWasmError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort') || msg.includes('Module.arguments') || msg.includes('Failed to fetch') || msg.includes('timeout')) {
      this.wasmErrorCount++;
      if (this.wasmErrorCount >= this.maxWasmErrors) {
        console.warn('[Gesture] WASM/timeout errors detected, stopping camera');
        this.notifyCameraStatus('inactive', '手势识别出错，请重新启动摄像头');
        this.stopCamera();
        this.wasmErrorCount = 0;
      }
    }
  }

  onResults(results: HandResults): void {
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

      const handSpeed = Math.sqrt(this.state.handVelocityX ** 2 + this.state.handVelocityY ** 2);
      if (handSpeed > this.config.palmVelocityThreshold * 2.0) return;

      const raw = this.classifyGesture(lm);
      this.updateGestureHistory(raw, lm);

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

    if (!this.retryTimeout) {
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null;
      }, 1000);
    }
  }

  validateLandmarks(lm: Landmark2D[], results: HandResults): boolean {
    if (!lm || lm.length < 21) {
      console.warn('Invalid hand landmarks: expected 21, got', lm ? lm.length : 0);
      return false;
    }

    for (let i = 0; i < lm.length; i++) {
      if (
        !lm[i] ||
        !Number.isFinite(lm[i].x) ||
        !Number.isFinite(lm[i].y) ||
        !Number.isFinite(lm[i].z)
      ) {
        console.warn('Invalid landmark data at index', i);
        return false;
      }
      if (
        lm[i].x < -0.1 || lm[i].x > 1.1 ||
        lm[i].y < -0.1 || lm[i].y > 1.1 ||
        lm[i].z! < -0.5 || lm[i].z! > 0.5
      ) {
        console.warn('Out of range landmark at index', i, lm[i]);
        return false;
      }
    }

    if (
      results.multiHandedness &&
      results.multiHandedness.length > 0 &&
      results.multiHandedness[0].score < 0.5
    ) {
      console.log('⚠️ Low handedness confidence:', results.multiHandedness[0].score.toFixed(2));
      return false;
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

    if (this.state.fingerTip3D) {
      this.state.prevFingerTip3D = { ...this.state.fingerTip3D };
    } else {
      this.state.prevFingerTip3D = { ...newTip3D };
    }
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
      const allSame = recentFrames.every((f) => f === raw);
      const isStable =
        allSame && recentFrames.length >= Math.max(2, this.config.debounceFrames - 2);
      const isLongEnough =
        nowMs - this.gestureHistory.lastGestureTime >=
        Math.max(80, this.config.minGestureDuration);

      if (isStable && isLongEnough && this.gestureHistory.stableGesture !== raw) {
        this.gestureHistory.hysteresisCount++;
        if (this.gestureHistory.hysteresisCount >= this.config.hysteresisFrames) {
          this.gestureHistory.stableGesture = raw;
          this.state.currentGesture = raw;
          this.gestureHistory.hysteresisCount = 0;
        }
      } else if (!isStable || !isLongEnough) {
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
    const [thumbExt, indexExt, middleExt, ringExt, pinkyExt] = fs;

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

  calculateFingerBend(lm: Landmark2D[]): FingerBend {
    const palmCenter = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
    };

    const extendedDist = {
      thumb: this.dist2d(lm[4], palmCenter),
      index: this.dist2d(lm[8], palmCenter),
      middle: this.dist2d(lm[12], palmCenter),
      ring: this.dist2d(lm[16], palmCenter),
      pinky: this.dist2d(lm[20], palmCenter),
    };

    const bentDist = {
      thumb: this.dist2d(lm[3], palmCenter),
      index: this.dist2d(lm[6], palmCenter),
      middle: this.dist2d(lm[10], palmCenter),
      ring: this.dist2d(lm[14], palmCenter),
      pinky: this.dist2d(lm[18], palmCenter),
    };

    return {
      thumb: bentDist.thumb / (extendedDist.thumb || 1),
      index: bentDist.index / (extendedDist.index || 1),
      middle: bentDist.middle / (extendedDist.middle || 1),
      ring: bentDist.ring / (extendedDist.ring || 1),
      pinky: bentDist.pinky / (extendedDist.pinky || 1),
    };
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
    const palmCenter = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
      z: ((lm[0].z ?? 0) + (lm[5].z ?? 0) + (lm[9].z ?? 0) + (lm[13].z ?? 0) + (lm[17].z ?? 0)) / 5,
    };

    const fingerTips = [4, 8, 12, 16, 20];
    let totalDist = 0;
    let maxDist = 0;

    for (const tipIdx of fingerTips) {
      const dist = this.dist3d(lm[tipIdx], palmCenter as Landmark2D);
      totalDist += dist;
      maxDist = Math.max(maxDist, dist);
    }

    return Math.min(1, Math.max(0, totalDist / (maxDist * 5)));
  }

  private handTo3D(hx: number, hy: number): THREE.Vector3 {
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
      return new THREE.Vector3(0, 2, 0);
    }
    const vh = 2 * Math.tan(Math.PI / 6) * 10;
    const vw = vh * (window.innerWidth / window.innerHeight);
    return new THREE.Vector3(
      (hx - 0.5) * vw * 0.8,
      -(hy - 0.5) * vh * 0.8,
      0,
    );
  }

  dist2d(a: Landmark2D, b: Landmark2D): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  dist3d(a: Landmark2D, b: Landmark2D): number {
    return Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z ?? 0) - (b.z ?? 0)) ** 2,
    );
  }

  on(event: 'gestureChange' | 'handPosition' | 'cameraStatus', callback: unknown): void {
    if (this.listeners[event]) {
      this.listeners[event].push(callback as never);
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
    return { ...this.state };
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
      this.mpHands.close();
    }
    Object.keys(this.listeners).forEach((key) => {
      (this.listeners as unknown as Record<string, unknown[]>)[key] = [];
    });
  }
}

export default GestureRecognizer;
