var GestureRecognizer = class {
  config;
  state;
  mpHands = null;
  videoElement;
  cameraActive = false;
  isSending = false;
  animationFrameId = null;
  isDestroyed = false;
  retryTimeout = null;
  sendRecoveryTimer = null;
  gestureHistory;
  listeners;
  modelReady = false;
  consecutiveErrors = 0;
  maxConsecutiveErrors = 30;
  frameSkipCount = 0;
  lastProcessTime = 0;
  minProcessInterval = 50;
  pendingSend = null;
  _sendResolve = null;
  _sendReject = null;

  constructor(config = {}) {
    this.config = {
      swordPointAngleThreshold: config.swordPointAngleThreshold ?? 0.5,
      peaceAngleThreshold: config.peaceAngleThreshold ?? 0.4,
      thumbDistRatio: config.thumbDistRatio ?? 1.1,
      fingerBendThreshold: config.fingerBendThreshold ?? 0.04,
      palmVelocityThreshold: config.palmVelocityThreshold ?? 3.0,
      debounceFrames: config.debounceFrames ?? 3,
      hysteresisFrames: config.hysteresisFrames ?? 3,
      minGestureDuration: config.minGestureDuration ?? 150,
      recoveryDelay: config.recoveryDelay ?? 300
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
        return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file;
      }
    });
    this.mpHands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    this.mpHands.onResults((results) => {
      if (!this.modelReady) {
        this.modelReady = true;
        console.log("[Gesture] Model loaded and ready");
      }
      this.onResults(results);
    });
    console.log("[Gesture] MediaPipe Hands initialized");
  }

  async startCamera() {
    this.notifyCameraStatus("loading", "\u6B63\u5728\u8BF7\u6C42\u6444\u50CF\u5934\u6743\u9650...");
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: "user"
        },
        audio: false
      });
      console.log("[Gesture] Camera stream obtained:", stream.getVideoTracks()[0].label);
    } catch (e) {
      this.notifyCameraStatus("inactive", "\u6444\u50CF\u5934\u8BBF\u95EE\u88AB\u62D2\u7EDD: " + e.message);
      throw e;
    }

    if (!this.videoElement) throw new Error("Video element not initialized");

    this.videoElement.srcObject = stream;
    this.videoElement.setAttribute("playsinline", "");
    this.videoElement.setAttribute("autoplay", "");
    this.videoElement.setAttribute("muted", "");
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.autoplay = true;

    var self = this;
    return new Promise(function(resolve, reject) {
      var resolved = false;
      function done() {
        if (resolved) return;
        resolved = true;
        self.cameraActive = true;
        self.notifyCameraStatus("active", "\u6444\u50CF\u5934\u5DF2\u542F\u52A8 - \u6A21\u578B\u52A0\u8F7D\u4E2D...");
        setTimeout(function() { self.processVideoFrames(); }, 1000);
        resolve();
      }

      self.videoElement.onloadedmetadata = function() {
        console.log("[Gesture] Video metadata loaded, readyState=" + self.videoElement.readyState);
        self.videoElement.play().then(done).catch(function(e) {
          console.warn("[Gesture] play() rejected:", e.message);
          done();
        });
      };

      self.videoElement.onerror = function(e) {
        console.error("[Gesture] Video element error:", e);
        self.notifyCameraStatus("inactive", "\u89C6\u9891\u5143\u7D20\u9519\u8BEF");
        reject(e);
      };

      setTimeout(function() {
        if (!resolved) {
          console.warn("[Gesture] Camera start timeout, forcing start");
          done();
        }
      }, 8000);
    });
  }

  stopCamera() {
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
    if (this.videoElement && this.videoElement.srcObject) {
      var tracks = this.videoElement.srcObject.getTracks();
      for (var i = 0; i < tracks.length; i++) tracks[i].stop();
    }
    this.consecutiveErrors = 0;
    this.notifyCameraStatus("inactive", "\u6444\u50CF\u5934\u5DF2\u505C\u6B62");
  }

  processVideoFrames() {
    if (!this.cameraActive || this.isDestroyed) return;

    this.animationFrameId = requestAnimationFrame(this.processVideoFrames.bind(this));

    if (!this.videoElement || this.videoElement.readyState < 2) return;

    var now = performance.now();
    if (now - this.lastProcessTime < this.minProcessInterval) return;
    this.lastProcessTime = now;

    if (this.isSending) return;

    if (!this.mpHands) return;

    try {
      this.isSending = true;
      var self = this;
      var sendPromise = this.mpHands.send({ image: this.videoElement });
      if (sendPromise && sendPromise.then) {
        sendPromise.then(
          function() { self.isSending = false; },
          function(err) {
            self.isSending = false;
            self.consecutiveErrors++;
            if (self.consecutiveErrors >= self.maxConsecutiveErrors) {
              console.warn("[Gesture] Too many errors, pausing processing");
              self.consecutiveErrors = 0;
              self.isSending = false;
              if (self.sendRecoveryTimer) clearTimeout(self.sendRecoveryTimer);
              self.sendRecoveryTimer = setTimeout(function() {
                self.consecutiveErrors = 0;
                self.sendRecoveryTimer = null;
              }, 2000);
            }
          }
        );
      } else {
        this.isSending = false;
      }

      if (this.sendRecoveryTimer === null) {
        this.sendRecoveryTimer = setTimeout(function() {
          if (self.isSending) {
            console.warn("[Gesture] send() appears stuck, resetting flag");
            self.isSending = false;
          }
          self.sendRecoveryTimer = null;
        }, 5000);
      }
    } catch (e) {
      console.warn("[Gesture] send() error:", e.message);
      this.isSending = false;
    }
  }

  onResults(results) {
    try {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        this.handleNoHand();
        return;
      }
      var lm = results.multiHandLandmarks[0];
      if (!this.validateLandmarks(lm, results)) return;
      this.updateHandPosition(lm);
      this.updateHandRotation(lm);
      this.updateFingerTips(lm);
      var raw = this.classifyGesture(lm);
      this.updateGestureHistory(raw, lm);
      var handSpeed = Math.sqrt(
        this.state.handVelocityX * this.state.handVelocityX +
        this.state.handVelocityY * this.state.handVelocityY
      );
      if (handSpeed > this.config.palmVelocityThreshold * 1.5) return;
      this.notifyGestureChange({
        gesture: this.state.currentGesture,
        handPos: this.state.handPos,
        fingerTip3D: this.state.fingerTip3D ? this.state.fingerTip3D : void 0,
        peaceTarget: this.state.peaceTarget ? this.state.peaceTarget : void 0,
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
  }

  validateLandmarks(lm, results) {
    if (!lm || lm.length < 21) {
      return false;
    }
    for (var i = 0; i < 21; i++) {
      if (!lm[i] || !isFinite(lm[i].x) || !isFinite(lm[i].y) || !isFinite(lm[i].z)) {
        return false;
      }
    }
    if (results.multiHandedness && results.multiHandedness.length > 0) {
      if (results.multiHandedness[0].score < 0.4) return false;
    }
    return true;
  }

  updateHandPosition(lm) {
    var palmX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    var palmY = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    this.state.handPos = { x: palmX, y: palmY };
    var now = performance.now() / 1000;
    var hDelta = Math.max(now - this.state.lastHandTime, 0.001);
    this.state.handVelocityX = (palmX - this.state.prevHandX) / hDelta;
    this.state.handVelocityY = (palmY - this.state.prevHandY) / hDelta;
    this.state.prevHandX = palmX;
    this.state.prevHandY = palmY;
    this.state.lastHandTime = now;
    for (var i = 0; i < this.listeners.handPosition.length; i++) {
      this.listeners.handPosition[i](this.state.handPos);
    }
  }

  updateHandRotation(lm) {
    var dx = lm[9].x - lm[0].x;
    var dy = lm[9].y - lm[0].y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.state.targetHandRotation = Math.atan2(dy, dx);
    }
    this.state.handRotation += (this.state.targetHandRotation - this.state.handRotation) * 0.1;
  }

  updateFingerTips(lm) {
    var newTip3D = this.handTo3D(lm[8].x, lm[8].y);
    if (!this.state.fingerTip3D) {
      this.state.fingerTip3D = new THREE.Vector3(0, 2, 0);
      this.state.prevFingerTip3D = new THREE.Vector3(0, 2, 0);
    }
    this.state.prevFingerTip3D.copy(this.state.fingerTip3D);
    this.state.fingerTip3D = newTip3D;
    this.state.peaceTarget = this.handTo3D(
      (lm[8].x + lm[12].x) / 2,
      (lm[8].y + lm[12].y) / 2
    );
  }

  updateGestureHistory(raw) {
    var nowMs = performance.now();
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
      var recentFrames = this.gestureHistory.frames.slice(-this.config.debounceFrames);
      var allSame = true;
      for (var i = 1; i < recentFrames.length; i++) {
        if (recentFrames[i] !== raw) { allSame = false; break; }
      }
      var isStable = allSame && recentFrames.length >= Math.max(2, this.config.debounceFrames - 2);
      var isLongEnough = nowMs - this.gestureHistory.lastGestureTime >= 150;
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
    var fs = this.getFingerStates(lm);
    var indexExt = fs[1];
    var middleExt = fs[2];
    var ringExt = fs[3];
    var pinkyExt = fs[4];
    var thumbExt = fs[0];
    if (indexExt && !middleExt && !ringExt && !pinkyExt) return "sword_point";
    if (indexExt && middleExt && !ringExt && !pinkyExt) return "peace";
    var extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
    if (extendedCount >= 3 && indexExt && middleExt) return "open_palm";
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) return "fist";
    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      if (lm[4].y < lm[3].y - 0.03) return "thumb_up";
    }
    return "unknown";
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
    var tipToWrist = this.dist2d(lm[4], lm[0]);
    var ipToWrist = this.dist2d(lm[3], lm[0]);
    return tipToWrist > ipToWrist * 1.1;
  }

  isFingerExtended(lm, tipIdx, pipIdx, mcpIdx) {
    var tipToWrist = this.dist2d(lm[tipIdx], lm[0]);
    var pipToWrist = this.dist2d(lm[pipIdx], lm[0]);
    var mcpToWrist = this.dist2d(lm[mcpIdx], lm[0]);
    var isExtended = tipToWrist > pipToWrist && pipToWrist > mcpToWrist * 0.9;
    var tipToPip = this.dist2d(lm[tipIdx], lm[pipIdx]);
    var pipToMcp = this.dist2d(lm[pipIdx], lm[mcpIdx]);
    var straightRatio = tipToPip / (pipToMcp || 0.01);
    return isExtended || straightRatio > 0.8;
  }

  calculateHandOpenness(lm) {
    var palmCenter = { x: 0, y: 0, z: 0 };
    var pIdx = [0, 5, 9, 13, 17];
    for (var i = 0; i < pIdx.length; i++) {
      palmCenter.x += lm[pIdx[i]].x;
      palmCenter.y += lm[pIdx[i]].y;
      palmCenter.z += (lm[pIdx[i]].z || 0);
    }
    palmCenter.x /= pIdx.length;
    palmCenter.y /= pIdx.length;
    palmCenter.z /= pIdx.length;
    var fingerTips = [4, 8, 12, 16, 20];
    var totalDist = 0;
    var maxDist = 0;
    for (var j = 0; j < fingerTips.length; j++) {
      var dist = this.dist3d(lm[fingerTips[j]], palmCenter);
      totalDist += dist;
      if (dist > maxDist) maxDist = dist;
    }
    return Math.min(1, Math.max(0, totalDist / (maxDist * 5)));
  }

  handTo3D(hx, hy) {
    if (!isFinite(hx) || !isFinite(hy)) {
      return new THREE.Vector3(0, 2, 0);
    }
    var vh = 2 * Math.tan(Math.PI / 6) * 10;
    var vw = vh * (window.innerWidth / (window.innerHeight || 1));
    return new THREE.Vector3(
      (hx - 0.5) * vw * 0.8,
      -(hy - 0.5) * vh * 0.8,
      0
    );
  }

  dist2d(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  dist3d(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(function(cb) {
        return cb !== callback;
      });
    }
  }

  notifyGestureChange(payload) {
    for (var i = 0; i < this.listeners.gestureChange.length; i++) {
      this.listeners.gestureChange[i](payload);
    }
  }

  notifyCameraStatus(status, message) {
    for (var i = 0; i < this.listeners.cameraStatus.length; i++) {
      this.listeners.cameraStatus[i]({ status: status, message: message });
    }
  }

  getState() {
    var s = this.state;
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
      handRotation: s.handRotation
    };
  }

  isCameraActive() {
    return this.cameraActive;
  }

  updateSensitivity(sensitivity) {
    var base = { debounceFrames: 3, minGestureDuration: 150, palmVelocityThreshold: 3.0, hysteresisFrames: 3 };
    this.config.debounceFrames = Math.max(1, Math.round(base.debounceFrames / sensitivity));
    this.config.minGestureDuration = Math.max(50, Math.round(base.minGestureDuration / sensitivity));
    this.config.palmVelocityThreshold = base.palmVelocityThreshold * sensitivity;
    this.config.hysteresisFrames = Math.max(1, Math.round(base.hysteresisFrames / sensitivity));
  }

  dispose() {
    this.isDestroyed = true;
    this.stopCamera();
    if (this.mpHands) {
      try { this.mpHands.close(); } catch (e) {}
    }
    var keys = Object.keys(this.listeners);
    for (var i = 0; i < keys.length; i++) {
      this.listeners[keys[i]] = [];
    }
  }
};
var GestureRecognizer_default = GestureRecognizer;
export { GestureRecognizer, GestureRecognizer_default as default };
