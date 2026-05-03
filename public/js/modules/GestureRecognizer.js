// js/modules/GestureRecognizer.ts
var GestureRecognizer = class {
  config;
  state;
  mpHands = null;
  videoElement;
  cameraActive = false;
  isProcessing = false;
  animationFrameId = null;
  isDestroyed = false;
  retryTimeout = null;
  gestureHistory;
  listeners;
  constructor(config = {}) {
    this.config = {
      swordPointAngleThreshold: config.swordPointAngleThreshold ?? 0.5,
      peaceAngleThreshold: config.peaceAngleThreshold ?? 0.4,
      thumbDistRatio: config.thumbDistRatio ?? 1.1,
      fingerBendThreshold: config.fingerBendThreshold ?? 0.04,
      palmVelocityThreshold: config.palmVelocityThreshold ?? 2,
      debounceFrames: config.debounceFrames ?? 5,
      hysteresisFrames: config.hysteresisFrames ?? 3,
      minGestureDuration: config.minGestureDuration ?? 300,
      recoveryDelay: config.recoveryDelay ?? 500
    };
    this.state = {
      currentGesture: "none",
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
      handRotation: 0
    };
    this.mpHands = null;
    this.videoElement = null;
    this.gestureHistory = {
      frames: [],
      lastGestureTime: 0,
      stableGesture: "none",
      pendingGesture: "none"
    };
    this.listeners = {
      gestureChange: [],
      handPosition: [],
      cameraStatus: []
    };
  }
  async init(videoElement) {
    this.videoElement = videoElement;
    if (typeof Hands === "undefined") {
      throw new Error("MediaPipe Hands library not loaded!");
    }
    console.log("[Gesture] Initializing MediaPipe Hands...");
    this.mpHands = new Hands({
      locateFile: (file) => {
        const url = `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        console.log(`[Gesture] Loading WASM file: ${url}`);
        return url;
      }
    });
    this.mpHands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    this.mpHands.onResults((results) => this.onResults(results));
    console.log("[Gesture] MediaPipe Hands initialized successfully");
  }
  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
    });
    if (!this.videoElement) throw new Error("Video element not initialized");
    this.videoElement.srcObject = stream;
    this.videoElement.setAttribute("playsinline", "true");
    this.videoElement.setAttribute("autoplay", "true");
    this.videoElement.setAttribute("muted", "true");
    return new Promise((resolve, reject) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play().then(() => {
          this.cameraActive = true;
          this.notifyCameraStatus("active", "\u6444\u50CF\u5934\u5DF2\u542F\u52A8 - \u8BF7\u5C55\u793A\u624B\u52BF");
          setTimeout(() => this.processVideoFrames(), 500);
          resolve();
        }).catch(reject);
      };
      this.videoElement.onerror = (e) => {
        this.notifyCameraStatus("inactive", "\u6444\u50CF\u5934\u8BBF\u95EE\u5931\u8D25");
        reject(e);
      };
    });
  }
  stopCamera() {
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
      this.videoElement.srcObject.getTracks().forEach((track) => track.stop());
    }
    this.notifyCameraStatus("inactive", "\u6444\u50CF\u5934\u5DF2\u505C\u6B62");
  }
  async processVideoFrames() {
    if (!this.cameraActive || !this.mpHands || this.isDestroyed) return;
    if (!this.videoElement || this.videoElement.readyState < 2) {
      this.animationFrameId = requestAnimationFrame(() => {
        void this.processVideoFrames();
      });
      return;
    }
    if (this.isProcessing) {
      this.animationFrameId = requestAnimationFrame(() => {
        void this.processVideoFrames();
      });
      return;
    }
    try {
      this.isProcessing = true;
      const sendPromise = this.mpHands.send({ image: this.videoElement });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("MediaPipe send timeout")), 5000)
      );
      await Promise.race([sendPromise, timeoutPromise]);
    } catch (error) {
      console.warn("[Gesture] processVideoFrames error:", error.message);
      this.handleWasmError(error);
    } finally {
      this.isProcessing = false;
    }
    if (!this.isDestroyed) {
      this.animationFrameId = requestAnimationFrame(() => {
        void this.processVideoFrames();
      });
    }
  }
  wasmErrorCount = 0;
  maxWasmErrors = 3;
  handleWasmError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("abort") || msg.includes("Module.arguments") || msg.includes("Failed to fetch")) {
      this.wasmErrorCount++;
      if (this.wasmErrorCount >= this.maxWasmErrors) {
        console.warn("[Gesture] WASM errors detected, attempting recovery...");
        this.notifyCameraStatus("inactive", "\u624B\u52BF\u8BC6\u522B\u51FA\u9519\uFF0C\u8BF7\u91CD\u65B0\u542F\u52A8\u6444\u50CF\u5934");
        this.wasmErrorCount = 0;
      }
    }
  }
  handleSendError(error) {
    console.error("Error sending frame to MediaPipe:", error);
    this.handleWasmError(error);
  }
  onResults(results) {
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
      const handSpeed = Math.sqrt(this.state.handVelocityX ** 2 + this.state.handVelocityY ** 2);
      if (handSpeed > this.config.palmVelocityThreshold * 1.5) return;
      this.notifyGestureChange({
        gesture: this.state.currentGesture,
        handPos: this.state.handPos,
        fingerTip3D: this.state.fingerTip3D ?? void 0,
        peaceTarget: this.state.peaceTarget ?? void 0,
        handOpenness: this.calculateHandOpenness(lm)
      });
    } catch (error) {
      console.error("Error in hand results processing:", error);
      this.handleError();
    }
  }
  handleNoHand() {
    this.state.gestureFrames = 0;
    this.state.currentGesture = "none";
    this.notifyGestureChange({ gesture: "none" });
  }
  handleError() {
    this.state.currentGesture = "none";
    this.state.gestureFrames = 0;
    this.gestureHistory.stableGesture = "none";
    this.gestureHistory.pendingGesture = "none";
    this.gestureHistory.frames = [];
    this.notifyGestureChange({ gesture: "none" });
    if (!this.retryTimeout) {
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null;
      }, 1e3);
    }
  }
  validateLandmarks(lm, results) {
    if (!lm || lm.length < 21) {
      console.warn("Invalid hand landmarks: expected 21, got", lm ? lm.length : 0);
      return false;
    }
    for (let i = 0; i < lm.length; i++) {
      if (!lm[i] || !Number.isFinite(lm[i].x) || !Number.isFinite(lm[i].y) || !Number.isFinite(lm[i].z)) {
        console.warn("Invalid landmark data at index", i);
        return false;
      }
      if (lm[i].x < -0.1 || lm[i].x > 1.1 || lm[i].y < -0.1 || lm[i].y > 1.1 || lm[i].z < -0.5 || lm[i].z > 0.5) {
        console.warn("Out of range landmark at index", i, lm[i]);
        return false;
      }
    }
    if (results.multiHandedness && results.multiHandedness.length > 0 && results.multiHandedness[0].score < 0.5) {
      console.log("\u26A0\uFE0F Low handedness confidence:", results.multiHandedness[0].score.toFixed(2));
      return false;
    }
    return true;
  }
  updateHandPosition(lm) {
    const palmX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    const palmY = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    this.state.handPos = { x: palmX, y: palmY };
    const now = performance.now() / 1e3;
    const hDelta = Math.max(now - this.state.lastHandTime, 1e-3);
    this.state.handVelocityX = (palmX - this.state.prevHandX) / hDelta;
    this.state.handVelocityY = (palmY - this.state.prevHandY) / hDelta;
    this.state.prevHandX = palmX;
    this.state.prevHandY = palmY;
    this.state.lastHandTime = now;
    this.listeners.handPosition.forEach((cb) => cb(this.state.handPos));
  }
  updateHandRotation(lm) {
    const dx = lm[9].x - lm[0].x;
    const dy = lm[9].y - lm[0].y;
    if (Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3) {
      this.state.targetHandRotation = Math.atan2(dy, dx);
    }
    this.state.handRotation += (this.state.targetHandRotation - this.state.handRotation) * 0.1;
  }
  updateFingerTips(lm) {
    const newTip3D = this.handTo3D(lm[8].x, lm[8].y);
    if (this.state.fingerTip3D) {
      this.state.prevFingerTip3D = { ...this.state.fingerTip3D };
    } else {
      this.state.prevFingerTip3D = { ...newTip3D };
    }
    this.state.fingerTip3D = newTip3D;
    this.state.peaceTarget = this.handTo3D(
      (lm[8].x + lm[12].x) / 2,
      (lm[8].y + lm[12].y) / 2
    );
  }
  updateGestureHistory(raw, _lm) {
    const nowMs = performance.now();
    if (raw !== "unknown") {
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
      const isStable = allSame && recentFrames.length >= Math.max(2, this.config.debounceFrames - 2);
      const isLongEnough = nowMs - this.gestureHistory.lastGestureTime >= Math.min(150, this.config.minGestureDuration);
      if (isStable && isLongEnough && this.gestureHistory.stableGesture !== raw) {
        this.gestureHistory.stableGesture = raw;
        this.state.currentGesture = raw;
      }
    } else {
      if (nowMs - this.gestureHistory.lastGestureTime > this.config.recoveryDelay) {
        this.gestureHistory.stableGesture = "none";
        this.gestureHistory.pendingGesture = "none";
        this.gestureHistory.frames = [];
      }
    }
  }
  classifyGesture(lm) {
    const fs = this.getFingerStates(lm);
    const [thumbExt, indexExt, middleExt, ringExt, pinkyExt] = fs;
    if (indexExt && !middleExt && !ringExt && !pinkyExt) return "sword_point";
    if (indexExt && middleExt && !ringExt && !pinkyExt) return "peace";
    if (indexExt && middleExt && ringExt && pinkyExt) return "open_palm";
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) return "fist";
    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      if (lm[4].y < lm[3].y - 0.03) return "thumb_up";
    }
    return "unknown";
  }
  calculateFingerBend(lm) {
    const palmCenter = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5
    };
    const extendedDist = {
      thumb: this.dist2d(lm[4], palmCenter),
      index: this.dist2d(lm[8], palmCenter),
      middle: this.dist2d(lm[12], palmCenter),
      ring: this.dist2d(lm[16], palmCenter),
      pinky: this.dist2d(lm[20], palmCenter)
    };
    const bentDist = {
      thumb: this.dist2d(lm[3], palmCenter),
      index: this.dist2d(lm[6], palmCenter),
      middle: this.dist2d(lm[10], palmCenter),
      ring: this.dist2d(lm[14], palmCenter),
      pinky: this.dist2d(lm[18], palmCenter)
    };
    return {
      thumb: bentDist.thumb / (extendedDist.thumb || 1),
      index: bentDist.index / (extendedDist.index || 1),
      middle: bentDist.middle / (extendedDist.middle || 1),
      ring: bentDist.ring / (extendedDist.ring || 1),
      pinky: bentDist.pinky / (extendedDist.pinky || 1)
    };
  }
  getFingerStates(lm) {
    if (!lm || lm.length < 21) return [false, false, false, false, false];
    return [
      this.isThumbExtended(lm),
      this.isFingerExtended(lm, 8, 6, 5),
      this.isFingerExtended(lm, 12, 10, 9),
      this.isFingerExtended(lm, 16, 14, 13),
      this.isFingerExtended(lm, 20, 18, 17)
    ];
  }
  isThumbExtended(lm) {
    const tipToWrist = this.dist2d(lm[4], lm[0]);
    const ipToWrist = this.dist2d(lm[3], lm[0]);
    return tipToWrist > ipToWrist * 1.1;
  }
  isFingerExtended(lm, tipIdx, pipIdx, mcpIdx) {
    const tipToWrist = this.dist2d(lm[tipIdx], lm[0]);
    const pipToWrist = this.dist2d(lm[pipIdx], lm[0]);
    const mcpToWrist = this.dist2d(lm[mcpIdx], lm[0]);
    const isExtended = tipToWrist > pipToWrist && pipToWrist > mcpToWrist * 0.9;
    const tipToPip = this.dist2d(lm[tipIdx], lm[pipIdx]);
    const pipToMcp = this.dist2d(lm[pipIdx], lm[mcpIdx]);
    const straightRatio = tipToPip / (pipToMcp || 0.01);
    return isExtended || straightRatio > 0.8;
  }
  calculateHandOpenness(lm) {
    const palmCenter = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
      z: (lm[0].z ?? 0 + lm[5].z + lm[9].z + lm[13].z + lm[17].z) / 5
    };
    const fingerTips = [4, 8, 12, 16, 20];
    let totalDist = 0;
    let maxDist = 0;
    for (const tipIdx of fingerTips) {
      const dist = this.dist3d(lm[tipIdx], palmCenter);
      totalDist += dist;
      maxDist = Math.max(maxDist, dist);
    }
    return Math.min(1, Math.max(0, totalDist / (maxDist * 5)));
  }
  handTo3D(hx, hy) {
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
      return new THREE.Vector3(0, 2, 0);
    }
    const vh = 2 * Math.tan(Math.PI / 6) * 10;
    const vw = vh * (window.innerWidth / window.innerHeight);
    return new THREE.Vector3(
      (hx - 0.5) * vw * 0.8,
      -(hy - 0.5) * vh * 0.8,
      0
    );
  }
  dist2d(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  dist3d(a, b) {
    return Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z ?? 0) - (b.z ?? 0)) ** 2
    );
  }
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    }
  }
  notifyGestureChange(payload) {
    this.listeners.gestureChange.forEach((cb) => cb(payload));
  }
  notifyCameraStatus(status, message) {
    this.listeners.cameraStatus.forEach((cb) => cb({ status, message }));
  }
  getState() {
    return { ...this.state };
  }
  isCameraActive() {
    return this.cameraActive;
  }
  dispose() {
    this.isDestroyed = true;
    this.stopCamera();
    if (this.mpHands) {
      this.mpHands.close();
    }
    Object.keys(this.listeners).forEach((key) => {
      this.listeners[key] = [];
    });
  }
};
var GestureRecognizer_default = GestureRecognizer;
export {
  GestureRecognizer,
  GestureRecognizer_default as default
};
