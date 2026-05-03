/**
 * @typedef {Object} GestureRecognizerConfig
 * @property {number} [swordPointAngleThreshold=0.5]
 * @property {number} [peaceAngleThreshold=0.4]
 * @property {number} [thumbDistRatio=1.1]
 * @property {number} [fingerBendThreshold=0.04]
 * @property {number} [palmVelocityThreshold=2.0]
 * @property {number} [debounceFrames=5]
 * @property {number} [hysteresisFrames=3]
 * @property {number} [minGestureDuration=300]
 * @property {number} [recoveryDelay=500]
 */

/**
 * @typedef {Object} GestureRecognizerState
 * @property {string} currentGesture
 * @property {number} gestureFrames
 * @property {{x: number, y: number}} handPos
 * @property {number} handVelocityX
 * @property {number} handVelocityY
 * @property {number} prevHandX
 * @property {number} prevHandY
 * @property {number} lastHandTime
 * @property {THREE.Vector3|null} fingerTip3D
 * @property {THREE.Vector3|null} prevFingerTip3D
 * @property {THREE.Vector3|null} peaceTarget
 * @property {number} targetHandRotation
 * @property {number} handRotation
 */

/**
 * @typedef {Object} GestureHistory
 * @property {string[]} frames
 * @property {number} lastGestureTime
 * @property {string} stableGesture
 * @property {string} pendingGesture
 */

/**
 * @typedef {Object} Landmark2D
 * @property {number} x
 * @property {number} y
 * @property {number} [z]
 */

/**
 * @typedef {Object} GestureChangePayload
 * @property {string} gesture
 * @property {{x: number, y: number}} [handPos]
 * @property {THREE.Vector3} [fingerTip3D]
 * @property {THREE.Vector3} [peaceTarget]
 * @property {number} [handOpenness]
 */

/**
 * MediaPipe Hand landmark-based gesture recognizer.
 *
 * Supports: sword_point, peace, fist, open_palm, thumb_up, none, unknown
 */
import { AppConfig } from './Config.js';

export class GestureRecognizer {
    constructor(config = {}) {
        this.config = {
            swordPointAngleThreshold: 0.5,
            peaceAngleThreshold: 0.4,
            thumbDistRatio: 1.1,
            fingerBendThreshold: 0.04,
            palmVelocityThreshold: 3.0,
            debounceFrames: 3,
            hysteresisFrames: 3,
            minGestureDuration: 150,
            recoveryDelay: 300,
            ...config
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
            handRotation: 0
        };

        this.mpHands = null;
        this.videoElement = null;
        this.cameraActive = false;
        this.isProcessing = false;
        this.animationFrameId = null;
        this.isDestroyed = false;
        this.retryTimeout = null;

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
            cameraStatus: []
        };
    }

    async init(videoElement) {
        this.videoElement = videoElement;

        if (typeof Hands === 'undefined') {
            console.error('MediaPipe Hands library not loaded!');
            throw new Error('MediaPipe Hands library not loaded!');
        }

        this.mpHands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.mpHands.setOptions({
            maxNumHands: AppConfig.camera.maxNumHands,
            modelComplexity: AppConfig.camera.modelComplexity,
            minDetectionConfidence: AppConfig.camera.minDetectionConfidence,
            minTrackingConfidence: AppConfig.camera.minTrackingConfidence,
        });

        this.mpHands.onResults((results) => this.onResults(results));
    }

    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        this.videoElement.srcObject = stream;
        this.videoElement.setAttribute('playsinline', 'true');
        this.videoElement.setAttribute('autoplay', 'true');
        this.videoElement.setAttribute('muted', 'true');

        return new Promise((resolve, reject) => {
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play()
                    .then(() => {
                        this.cameraActive = true;
                        this.notify('cameraStatus', { status: 'active', message: '摄像头已启动 - 请展示手势' });
                        setTimeout(() => this.processVideoFrames(), 500);
                        resolve();
                    })
                    .catch(reject);
            };

            this.videoElement.onerror = (e) => {
                this.notify('cameraStatus', { status: 'inactive', message: '摄像头访问失败' });
                reject(e);
            };
        });
    }

    stopCamera() {
        this.cameraActive = false;
        this.isProcessing = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
        }

        this.notify('cameraStatus', { status: 'inactive', message: '摄像头已停止' });
    }

    async processVideoFrames() {
        if (!this.cameraActive || !this.mpHands || this.isDestroyed) {
            return;
        }

        if (this.isProcessing) {
            this.animationFrameId = requestAnimationFrame(() => this.processVideoFrames());
            return;
        }

        if (!this.videoElement || this.videoElement.readyState < 2) {
            this.animationFrameId = requestAnimationFrame(() => this.processVideoFrames());
            return;
        }

        try {
            this.isProcessing = true;
            await this.mpHands.send({ image: this.videoElement });
            this.isProcessing = false;
        } catch (e) {
            console.error('Error processing frame:', e);
            this.isProcessing = false;
        }

        this.animationFrameId = requestAnimationFrame(() => this.processVideoFrames());
    }

    onResults(results) {
        try {
            if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
                this.handleNoHand();
                return;
            }

            const lm = results.multiHandLandmarks[0];
            if (!this.validateLandmarks(lm, results)) {
                return;
            }

            this.updateHandPosition(lm);
            this.updateHandRotation(lm);
            this.updateFingerTips(lm);

            const raw = this.classifyGesture(lm);

            const handSpeed = Math.sqrt(this.state.handVelocityX ** 2 + this.state.handVelocityY ** 2);
            if (handSpeed > this.config.palmVelocityThreshold * 2.0) {
                return;
            }

            this.updateGestureHistory(raw, lm);

            this.notify('gestureChange', {
                gesture: this.state.currentGesture,
                handPos: this.state.handPos,
                fingerTip3D: this.state.fingerTip3D,
                peaceTarget: this.state.peaceTarget,
                handOpenness: this.calculateHandOpenness(lm)
            });

        } catch (error) {
            console.error('Error in hand results processing:', error);
            this.handleError();
        }
    }

    handleNoHand() {
        this.state.gestureFrames = 0;
        this.state.currentGesture = 'none';
        this.notify('gestureChange', { gesture: 'none' });
    }

    handleError() {
        this.state.currentGesture = 'none';
        this.state.gestureFrames = 0;

        this.gestureHistory.stableGesture = 'none';
        this.gestureHistory.pendingGesture = 'none';
        this.gestureHistory.frames = [];

        this.notify('gestureChange', { gesture: 'none' });

        if (!this.retryTimeout) {
            this.retryTimeout = setTimeout(() => {
                this.retryTimeout = null;
            }, 1000);
        }
    }

    validateLandmarks(lm, results) {
        if (!lm || lm.length < 21) {
            console.warn('Invalid hand landmarks: expected 21, got', lm ? lm.length : 0);
            return false;
        }

        for (let i = 0; i < lm.length; i++) {
            if (!lm[i] ||
                !Number.isFinite(lm[i].x) ||
                !Number.isFinite(lm[i].y) ||
                !Number.isFinite(lm[i].z)) {
                console.warn('Invalid landmark data at index', i);
                return false;
            }

            if (lm[i].x < -0.1 || lm[i].x > 1.1 ||
                lm[i].y < -0.1 || lm[i].y > 1.1 ||
                lm[i].z < -0.5 || lm[i].z > 0.5) {
                console.warn('Out of range landmark at index', i, lm[i]);
                return false;
            }
        }

        if (results && results.multiHandedness && results.multiHandedness.length > 0) {
            const handedness = results.multiHandedness[0];
            if (handedness && handedness.score < 0.5) {
                console.log('⚠️ Low handedness confidence:', handedness.score.toFixed(2));
                return false;
            }
        }

        return true;
    }

    updateHandPosition(lm) {
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

        this.notify('handPosition', this.state.handPos);
    }

    updateHandRotation(lm) {
        const dx = lm[9].x - lm[0].x;
        const dy = lm[9].y - lm[0].y;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            this.state.targetHandRotation = Math.atan2(dy, dx);
        }
        this.state.handRotation += (this.state.targetHandRotation - this.state.handRotation) * 0.1;
    }

    updateFingerTips(lm) {
        const newTip3D = this.handTo3D(lm[8].x, lm[8].y);

        if (this.state.fingerTip3D) {
            this.state.prevFingerTip3D = this.state.fingerTip3D.clone();
        } else {
            this.state.prevFingerTip3D = newTip3D.clone();
        }
        this.state.fingerTip3D = newTip3D;

        this.state.peaceTarget = this.handTo3D((lm[8].x + lm[12].x) / 2, (lm[8].y + lm[12].y) / 2);
    }

    updateGestureHistory(raw, lm) {
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
            const allSame = recentFrames.every(f => f === raw);
            const isStable = allSame && recentFrames.length >= Math.max(2, this.config.debounceFrames - 2);
            const isLongEnough = (nowMs - this.gestureHistory.lastGestureTime) >= Math.max(80, this.config.minGestureDuration);

            if (isStable && isLongEnough) {
                if (this.gestureHistory.stableGesture !== raw) {
                    this.gestureHistory.hysteresisCount++;
                    if (this.gestureHistory.hysteresisCount >= this.config.hysteresisFrames) {
                        this.gestureHistory.stableGesture = raw;
                        this.state.currentGesture = raw;
                        this.gestureHistory.hysteresisCount = 0;
                    }
                } else {
                    this.gestureHistory.hysteresisCount = 0;
                }
            }
        } else {
            if (nowMs - this.gestureHistory.lastGestureTime > this.config.recoveryDelay) {
                this.gestureHistory.stableGesture = 'none';
                this.gestureHistory.pendingGesture = 'none';
                this.gestureHistory.frames = [];
            }
        }
    }

    classifyGesture(lm) {
        const fs = this.getFingerStates(lm);
        const [thumbExt, indexExt, middleExt, ringExt, pinkyExt] = fs;
        const fingerBend = this.calculateFingerBend(lm);

        // Finger state debug removed for production performance

        if (indexExt && !middleExt && !ringExt && !pinkyExt) {
            return 'sword_point';
        }

        if (indexExt && middleExt && !ringExt && !pinkyExt) {
            return 'peace';
        }

        const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
        if (extendedCount >= 3 && indexExt && middleExt) {
            return 'open_palm';
        }

        if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
            return 'fist';
        }

        if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
            const thumbUp = lm[4].y < lm[3].y - 0.03;
            if (thumbUp) {
                return 'thumb_up';
            }
        }

        return 'unknown';
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
        if (!lm || lm.length < 21) {
            return [false, false, false, false, false];
        }

        const thumbExt = this.isThumbExtended(lm);
        const indexExt = this.isFingerExtended(lm, 8, 6, 5);
        const middleExt = this.isFingerExtended(lm, 12, 10, 9);
        const ringExt = this.isFingerExtended(lm, 16, 14, 13);
        const pinkyExt = this.isFingerExtended(lm, 20, 18, 17);

        return [thumbExt, indexExt, middleExt, ringExt, pinkyExt];
    }

    isThumbExtended(lm) {
        const thumbTip = lm[4];
        const thumbIP = lm[3];
        const thumbMCP = lm[2];
        const wrist = lm[0];

        const tipToWrist = this.dist2d(thumbTip, wrist);
        const ipToWrist = this.dist2d(thumbIP, wrist);

        return tipToWrist > ipToWrist * 1.1;
    }

    isFingerExtended(lm, tipIdx, pipIdx, mcpIdx) {
        const tip = lm[tipIdx];
        const pip = lm[pipIdx];
        const mcp = lm[mcpIdx];
        const wrist = lm[0];

        const tipToWrist = this.dist2d(tip, wrist);
        const pipToWrist = this.dist2d(pip, wrist);
        const mcpToWrist = this.dist2d(mcp, wrist);

        const isExtended = tipToWrist > pipToWrist && pipToWrist > mcpToWrist * 0.9;

        const tipToPip = this.dist2d(tip, pip);
        const pipToMcp = this.dist2d(pip, mcp);
        const straightRatio = tipToPip / (pipToMcp || 0.01);

        return isExtended || straightRatio > 0.8;
    }

    calculateHandOpenness(lm) {
        const palmCenter = {
            x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
            y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
            z: (lm[0].z + lm[5].z + lm[9].z + lm[13].z + lm[17].z) / 5,
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
        return new THREE.Vector3((hx - 0.5) * vw * 0.8, -(hy - 0.5) * vh * 0.8, 0);
    }

    dist2d(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    dist3d(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    getState() {
        return { ...this.state };
    }

    isCameraActive() {
        return this.cameraActive;
    }

    updateSensitivity(sensitivity) {
        const base = AppConfig.gesture;
        this.config.debounceFrames = Math.max(1, Math.round(base.debounceFrames / sensitivity));
        this.config.minGestureDuration = Math.max(50, Math.round(base.minGestureDuration / sensitivity));
        this.config.palmVelocityThreshold = base.palmVelocityThreshold * sensitivity;
        this.config.hysteresisFrames = Math.max(1, Math.round(base.hysteresisFrames / sensitivity));
    }

    dispose() {
        this.isDestroyed = true;
        this.stopCamera();

        if (this.mpHands) {
            this.mpHands.close();
            this.mpHands = null;
        }

        Object.keys(this.listeners).forEach(key => {
            this.listeners[key] = [];
        });
    }
}