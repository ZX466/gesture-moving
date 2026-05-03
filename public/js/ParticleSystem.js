import { SceneManager } from './modules/SceneManager.js';
import { SwordSystem } from './modules/SwordSystem.js';
import { GestureRecognizer } from './modules/GestureRecognizer.js';
import { UIManager } from './modules/UIManager.js';
import { ShapeGenerators } from './modules/ShapeGenerators.js';
import { ErrorManager, errorManager } from './modules/ErrorManager.js';
import { PerformanceMonitor, performanceMonitor } from './modules/PerformanceMonitor.js';
import { AppConfig } from './modules/Config.js';
import { ParticleAnimator } from './modules/ParticleAnimator.js';

/**
 * @typedef {Object} ParticleSystemConfig
 * @property {string} [containerId]
 * @property {string} [defaultColor]
 * @property {string} [defaultModel]
 * @property {number} [defaultCount]
 * @property {number} [defaultSize]
 * @property {number} [defaultSensitivity]
 */

/**
 * @typedef {Object} ParticleSystemState
 * @property {string} currentModel
 * @property {THREE.Color} particleColor
 * @property {number} particleCount
 * @property {number} particleSize
 * @property {number} gestureSensitivity
 * @property {number} spreadFactor
 * @property {number} targetSpread
 * @property {Float32Array|null} targetPositions
 * @property {number} handRotation
 * @property {number} targetHandRotation
 * @property {boolean} handActive
 * @property {{x: number, y: number}} handPos
 */

/**
 * Main controller for the interactive particle art system.
 * Orchestrates scene, particles, sword, gesture recognition, and UI.
 */
export class ParticleSystem {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || AppConfig.scene.containerId || 'particle-container',
            defaultColor: config.defaultColor || AppConfig.particle.defaultColor,
            defaultModel: config.defaultModel || 'heart',
            defaultCount: config.defaultCount || AppConfig.particle.defaultCount,
            defaultSize: config.defaultSize || AppConfig.particle.defaultSize,
            defaultSensitivity: config.defaultSensitivity || AppConfig.gesture.defaultSensitivity,
            ...config
        };

        this.state = {
            currentModel: this.config.defaultModel,
            particleColor: new THREE.Color(this.config.defaultColor),
            particleCount: this.config.defaultCount,
            particleSize: this.config.defaultSize,
            gestureSensitivity: this.config.defaultSensitivity,
            spreadFactor: 0,
            targetSpread: 0,
            targetPositions: null,
            handRotation: 0,
            targetHandRotation: 0,
            handActive: false,
            handPos: { x: 0.5, y: 0.5 }
        };

        this.sceneManager = null;
        this.swordSystem = null;
        this.gestureRecognizer = null;
        this.uiManager = null;
        this.particles = null;
        this.particleAnimator = null;

        this.clock = new THREE.Clock();
        this.animationId = null;
        this.isRunning = false;
        this.isDestroyed = false;

        this.lastFrameTime = 0;

        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
    }

    setupErrorHandling() {
        errorManager.on((entry) => {
            if (entry.type === 'user_error' && this.uiManager) {
                this.uiManager.showError(entry.message);
            }
        });
    }

    setupPerformanceMonitoring() {
        performanceMonitor.on((data) => {
            if (data.level === 'critical') {
                console.warn('[Performance]', data.message);
                this.handlePerformanceIssue(data);
            }
        });
    }

    handlePerformanceIssue(data) {
        if (this.state.particleCount > 1000) {
            const newCount = Math.max(500, this.state.particleCount - 500);
            this.setParticleCount(newCount);
            console.log('[Performance] Reduced particle count to', newCount);
        }
    }

    init() {
        try {
            this.initScene();
            this.initParticles();
            this.initSword();
            this.initUI();
            this.initCamera();
            this.start();
            performanceMonitor.start();
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.init' });
            throw error;
        }
    }

    calcAdaptiveParticleSize(baseSize) {
        const isMobile = this.sceneManager?.getIsMobile() ?? false;
        if (isMobile) {
            // 移动端粒子尺寸增大（因为相机更近，需要补偿）
            return baseSize * 0.15;
        }
        // 桌面端
        return baseSize * 0.08;
    }

    initScene() {
        try {
            this.sceneManager = new SceneManager(this.config.containerId, {
                fov: AppConfig.scene.fov,
                cameraZ: AppConfig.scene.cameraZ,
                backgroundColor: AppConfig.scene.backgroundColor
            });
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.initScene' });
            throw error;
        }
    }

    initParticles() {
        try {
            this.state.targetPositions = ShapeGenerators[this.state.currentModel](this.state.particleCount);

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(this.state.particleCount * 3);
            for (let i = 0; i < this.state.particleCount * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 20;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
                color: this.state.particleColor,
                size: this.calcAdaptiveParticleSize(this.state.particleSize),
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            this.particles = new THREE.Points(geometry, material);
            this.sceneManager.addObject(this.particles);
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.initParticles' });
            throw error;
        }
    }

    initSword() {
        try {
            this.swordSystem = new SwordSystem(this.sceneManager.getScene(), {
                trailLength: AppConfig.sword.trailLength,
                orbitRadius: AppConfig.sword.orbitRadius,
                orbitSpeed: AppConfig.sword.orbitSpeed,
                flySpeed: AppConfig.sword.flySpeed,
                bobSpeed: AppConfig.sword.bobSpeed,
                bobAmplitude: AppConfig.sword.bobAmplitude,
                maxVelocity: AppConfig.sword.maxVelocity
            });
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.initSword' });
            throw error;
        }
    }

    initUI() {
        try {
            this.uiManager = new UIManager({
                onColorChange: (color) => this.setColor(color),
                onModelChange: (model) => this.setModel(model),
                onCountChange: (count) => this.setParticleCount(count),
                onSizeChange: (size) => this.setParticleSize(size),
                onSensitivityChange: (sensitivity) => this.setGestureSensitivity(sensitivity),
                onCameraStart: () => this.startCamera(),
                onCameraStop: () => this.stopCamera(),
                onSwordToggle: (enabled) => this.swordSystem.setVisible(enabled),
                onReset: () => this.reset(),
                onScreenshot: () => this.takeScreenshot(),
                onFullscreen: () => this.toggleFullscreen(),
                onError: (err) => errorManager.capture(err, { source: 'UIManager' })
            });
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.initUI' });
            throw error;
        }
    }

    initCamera() {
        try {
            this.gestureRecognizer = new GestureRecognizer({
                debounceFrames: AppConfig.gesture.debounceFrames,
                minGestureDuration: AppConfig.gesture.minGestureDuration,
                palmVelocityThreshold: AppConfig.gesture.palmVelocityThreshold
            });

            this.particleAnimator = new ParticleAnimator({
                state: this.state,
                gestureRecognizer: this.gestureRecognizer
            });

            this.gestureRecognizer.on('gestureChange', (data) => {
                this.handleGestureChange(data);
                this.uiManager.updateGestureHint(data.gesture);
            });

            this.gestureRecognizer.on('handPosition', (pos) => {
                this.state.handActive = pos !== null;
                this.state.handPos = pos || this.state.handPos;
            });

            this.gestureRecognizer.on('cameraStatus', (data) => {
                this.uiManager.updateCameraStatus(data.status, data.message);
            });
        } catch (error) {
            errorManager.handle(error, { context: 'ParticleSystem.initCamera' });
            throw error;
        }
    }

    handleGestureChange(data) {
        const { gesture, handPos, fingerTip3D, peaceTarget, handOpenness } = data;

        console.log('[ParticleSystem] Gesture change:', gesture, 'handPos:', handPos);

        if (handPos) {
            this.state.handPos = handPos;
        }

        if (this.uiManager.getSwordEnabled()) {
            switch (gesture) {
                case 'sword_point':
                    console.log('[ParticleSystem] Sword point - setting summoned');
                    if (fingerTip3D) {
                        this.swordSystem.setState('summoned', fingerTip3D);
                    }
                    this.state.targetSpread = 0;
                    break;
                case 'peace':
                    console.log('[ParticleSystem] Peace - setting flying');
                    this.swordSystem.setState('flying');
                    if (fingerTip3D) {
                        this.swordSystem.setFingerTip3D(fingerTip3D, fingerTip3D);
                    }
                    this.state.targetSpread = 0;
                    break;
                case 'fist':
                    console.log('[ParticleSystem] Fist - setting idle');
                    this.swordSystem.setState('idle');
                    this.state.targetSpread = 0;
                    break;
                case 'open_palm':
                    console.log('[ParticleSystem] Open palm - spreading');
                    this.swordSystem.setState('idle');
                    this.state.targetSpread = Math.max(0, Math.min(1, handOpenness || 0));
                    break;
                case 'thumb_up':
                    console.log('[ParticleSystem] Thumb up');
                    this.swordSystem.setState('idle');
                    this.state.targetSpread = 0;
                    break;
            }
        } else {
            if (gesture === 'open_palm') {
                this.state.targetSpread = Math.max(0, Math.min(1, handOpenness || 0));
            } else {
                this.state.targetSpread = Math.max(this.state.targetSpread - 0.02, 0);
            }
        }
    }

    setColor(color) {
        this.state.particleColor.set(color);
        if (this.particles) {
            this.particles.material.color.set(color);
        }
        if (this.swordSystem && this.swordSystem.swordGlow) {
            this.swordSystem.swordGlow.color.set(color);
        }
    }

    setModel(model) {
        if (!ShapeGenerators[model]) {
            console.warn('Model not found:', model);
            return;
        }
        this.state.currentModel = model;
        this.state.targetPositions = ShapeGenerators[model](this.state.particleCount);
    }

    setParticleCount(count) {
        count = AppConfig.validate(count, AppConfig.particle.minCount, AppConfig.particle.maxCount, this.state.particleCount);
        if (count === this.state.particleCount) return;

        this.state.particleCount = count;
        this.state.targetPositions = ShapeGenerators[this.state.currentModel](count);

        if (this.particles) {
            this.sceneManager.removeObject(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 20;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
                color: this.state.particleColor,
                size: this.calcAdaptiveParticleSize(this.state.particleSize),
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            this.particles = new THREE.Points(geometry, material);
            this.sceneManager.addObject(this.particles);
        }
    }

    setParticleSize(size) {
        this.state.particleSize = AppConfig.validate(size, AppConfig.particle.minSize, AppConfig.particle.maxSize, this.state.particleSize);
        if (this.particles) {
            this.particles.material.size = this.calcAdaptiveParticleSize(this.state.particleSize);
        }
    }

    setGestureSensitivity(sensitivity) {
        this.state.gestureSensitivity = AppConfig.validate(sensitivity, AppConfig.gesture.minSensitivity, AppConfig.gesture.maxSensitivity, this.state.gestureSensitivity);
    }

    reset() {
        this.state.targetSpread = 0;
        this.state.spreadFactor = 0;
        this.state.currentModel = this.config.defaultModel;
        this.state.particleColor.set(this.config.defaultColor);

        if (this.particles) {
            this.particles.material.color.set(this.config.defaultColor);
        }

        this.state.targetPositions = ShapeGenerators[this.config.defaultModel](this.state.particleCount);

        this.uiManager.setActiveModel(this.config.defaultModel);
    }

    takeScreenshot() {
        this.sceneManager.render();
        const link = document.createElement('a');
        link.download = 'particle-art-' + Date.now() + '.png';
        link.href = this.sceneManager.getRenderer().domElement.toDataURL('image/png');
        link.click();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    async startCamera() {
        const videoElement = document.getElementById('video-feed');
        if (!videoElement) {
            console.error('Video element not found');
            return;
        }

        try {
            await this.gestureRecognizer.init(videoElement);
            await this.gestureRecognizer.startCamera();
        } catch (e) {
            console.error('Failed to start camera:', e);
            this.uiManager.updateCameraStatus('inactive', '摄像头启动失败');
        }
    }

    stopCamera() {
        this.gestureRecognizer.stopCamera();
    }

    start() {
        if (this.isRunning || this.isDestroyed) return;
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate(currentTime = 0) {
        if (this.isDestroyed || !this.isRunning) return;

        this.animationId = requestAnimationFrame((t) => this.animate(t));

        const frameTime = currentTime - this.lastFrameTime;
        const minFrameTime = 1000 / AppConfig.animation.targetFps;
        if (frameTime < minFrameTime) return;
        this.lastFrameTime = currentTime - (frameTime % minFrameTime);

        const delta = Math.min(this.clock.getDelta(), AppConfig.animation.maxDelta);

        this.particleAnimator.updateFps(currentTime);
        this.particleAnimator.updateParticles(delta, this.particles, this.state.targetPositions, this.state.particleCount);
        this.particleAnimator.updateHandReactiveTransforms(delta, this.particles);
        this.updateSword(delta);

        if (this.sceneManager && this.sceneManager.getRenderer()) {
            performanceMonitor.recordRendererInfo(this.sceneManager.getRenderer());
        }

        this.sceneManager.render();
    }

    updateSword(delta) {
        if (!this.swordSystem) return;

        const elapsed = this.clock.getElapsedTime();
        this.swordSystem.update(delta, elapsed);
    }

    dispose() {
        this.isDestroyed = true;
        this.isRunning = false;

        performanceMonitor.stop();
        performanceMonitor.dispose();

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.gestureRecognizer) {
            this.gestureRecognizer.dispose();
        }

        if (this.swordSystem) {
            this.swordSystem.dispose();
        }

        if (this.particles) {
            this.sceneManager.removeObject(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }

        if (this.sceneManager) {
            this.sceneManager.dispose();
        }

        if (this.uiManager) {
            this.uiManager.dispose();
        }

        window.removeEventListener('resize', () => {});
    }
}