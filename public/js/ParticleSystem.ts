/**
 * @fileoverview Main orchestrator for the interactive particle art system.
 * Manages scene, particles, sword, gesture recognition, and UI lifecycle.
 */

import { SceneManager } from './modules/SceneManager.js';
import { SwordSystem } from './modules/SwordSystem.js';
import { GestureRecognizer } from './modules/GestureRecognizer.js';
import { UIManager } from './modules/UIManager.js';
import { ShapeGenerators } from './modules/ShapeGenerators.js';
import { ErrorManager, errorManager } from './modules/ErrorManager.js';
import { PerformanceMonitor, performanceMonitor } from './modules/PerformanceMonitor.js';
import { AppConfig } from './modules/Config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
import type {
  GestureChangePayload,
  ParticleSystemConfig,
  ParticleSystemState,
} from './types.js';

export class ParticleSystem {
  private readonly config: Required<ParticleSystemConfig>;
  public readonly state: ParticleSystemState;
  public sceneManager: SceneManager | null = null;
  public swordSystem: SwordSystem | null = null;
  public gestureRecognizer: GestureRecognizer | null = null;
  public uiManager: UIManager | null = null;
  public particles: THREE.Points | null = null;

  private readonly clock = new THREE.Clock();
  private animationId: number | null = null;
  private isRunning = false;
  public isDestroyed = false;

  private lastFrameTime = 0;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private fps = 0;

  constructor(config: ParticleSystemConfig = {}) {
    this.config = {
      containerId: config.containerId ?? AppConfig.scene.containerId ?? 'particle-container',
      defaultColor: config.defaultColor ?? AppConfig.particle.defaultColor,
      defaultModel: config.defaultModel ?? 'heart',
      defaultCount: config.defaultCount ?? AppConfig.particle.defaultCount,
      defaultSize: config.defaultSize ?? AppConfig.particle.defaultSize,
      defaultSensitivity: config.defaultSensitivity ?? AppConfig.gesture.defaultSensitivity,
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
      handPos: { x: 0.5, y: 0.5 },
    };

    this.setupErrorHandling();
    this.setupPerformanceMonitoring();
  }

  private setupErrorHandling(): void {
    errorManager.on((entry) => {
      if (('type' in entry && entry.type === 'user_error') && this.uiManager) {
        this.uiManager.showError(entry.message);
      }
    });
  }

  private setupPerformanceMonitoring(): void {
    performanceMonitor.on((data) => {
      if (data.level === 'critical') {
        console.warn('[Performance]', data.message);
        this.handlePerformanceIssue(data);
      }
    });
  }

  private handlePerformanceIssue(data: { fps: number }): void {
    if (this.state.particleCount > 1000) {
      const newCount = Math.max(500, this.state.particleCount - 500);
      this.setParticleCount(newCount);
      console.log('[Performance] Reduced particle count to', newCount);
    }
  }

  init(): void {
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

  private initScene(): void {
    this.sceneManager = new SceneManager(this.config.containerId, {
      fov: AppConfig.scene.fov,
      cameraZ: AppConfig.scene.cameraZ,
      backgroundColor: AppConfig.scene.backgroundColor,
    });
  }

  private calcAdaptiveParticleSize(baseSize: number): number {
    const isMobile = this.sceneManager?.getIsMobile() ?? false;
    if (isMobile) return baseSize * 0.25;
    return baseSize * 0.08;
  }

  private initParticles(): void {
    this.state.targetPositions = ShapeGenerators[this.state.currentModel](
      this.state.particleCount,
    );

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
    this.sceneManager!.addObject((this.particles ?? null) as any);
  }

  private initSword(): void {
    this.swordSystem = new SwordSystem(this.sceneManager!.getScene(), {
      trailLength: AppConfig.sword.trailLength,
      orbitRadius: AppConfig.sword.orbitRadius,
      orbitSpeed: AppConfig.sword.orbitSpeed,
      flySpeed: AppConfig.sword.flySpeed,
      bobSpeed: AppConfig.sword.bobSpeed,
      bobAmplitude: AppConfig.sword.bobAmplitude,
      maxVelocity: AppConfig.sword.maxVelocity,
    });
  }

  private initUI(): void {
    this.uiManager = new UIManager({
      onColorChange: (color) => this.setColor(color),
      onModelChange: (model) => this.setModel(model),
      onCountChange: (count) => this.setParticleCount(count),
      onSizeChange: (size) => this.setParticleSize(size),
      onSensitivityChange: (sensitivity) => this.setGestureSensitivity(sensitivity),
      onCameraStart: () => this.startCamera(),
      onCameraStop: () => this.stopCamera(),
      onSwordToggle: (enabled) => this.swordSystem?.setVisible(enabled),
      onReset: () => this.reset(),
      onScreenshot: () => this.takeScreenshot(),
      onFullscreen: () => this.toggleFullscreen(),
      onError: (err) => errorManager.capture(err, { source: 'UIManager' }),
    });
  }

  private initCamera(): void {
    this.gestureRecognizer = new GestureRecognizer({
      debounceFrames: AppConfig.gesture.debounceFrames,
      minGestureDuration: AppConfig.gesture.minGestureDuration,
      palmVelocityThreshold: AppConfig.gesture.palmVelocityThreshold,
    });

    this.gestureRecognizer.on('gestureChange', (data: GestureChangePayload) => {
      this.handleGestureChange(data);
      this.uiManager?.updateGestureHint(data.gesture);
    });

    this.gestureRecognizer.on('handPosition', (pos: { x: number; y: number } | null) => {
      this.state.handActive = pos !== null;
      this.state.handPos = pos ?? this.state.handPos;
    });

    this.gestureRecognizer.on('cameraStatus', (data: { status: string; message: string }) => {
      this.uiManager?.setCameraStatus(data.status as "active" | "starting" | "inactive", data.message);
    });
  }

  private handleGestureChange(data: GestureChangePayload): void {
    const { gesture, handPos, fingerTip3D, handOpenness } = data;

    if (handPos) {
      this.state.handPos = handPos;
    }

    if (this.uiManager?.isSwordEnabled()) {
      switch (gesture) {
        case 'sword_point':
          if (fingerTip3D) {
            this.swordSystem?.setState('summoned', new THREE.Vector3(fingerTip3D.x, fingerTip3D.y, fingerTip3D.z));
          }
          this.state.targetSpread = 0;
          break;
        case 'peace':
          this.swordSystem?.setState('flying');
          if (fingerTip3D) {
            this.swordSystem?.setFingerTip3D(new THREE.Vector3(fingerTip3D.x, fingerTip3D.y, fingerTip3D.z), new THREE.Vector3(fingerTip3D.x, fingerTip3D.y, fingerTip3D.z));
          }
          this.state.targetSpread = 0;
          break;
        case 'fist':
          this.swordSystem?.setState('idle');
          this.state.targetSpread = 0;
          break;
        case 'open_palm':
          this.swordSystem?.setState('idle');
          this.state.targetSpread = Math.max(0, Math.min(1, handOpenness ?? 0));
          break;
        case 'thumb_up':
          this.swordSystem?.setState('idle');
          this.state.targetSpread = 0;
          break;
        default:
          this.state.targetSpread = Math.max(this.state.targetSpread - 0.02, 0);
      }
    } else {
      if (gesture === 'open_palm') {
        this.state.targetSpread = Math.max(0, Math.min(1, handOpenness ?? 0));
      } else {
        this.state.targetSpread = Math.max(this.state.targetSpread - 0.02, 0);
      }
    }
  }

  setColor(color: string): void {
    this.state.particleColor.set(color);
    if (this.particles) {
      (this.particles.material as any).color.set(color);
    }
  }

  setModel(model: string): void {
    if (!ShapeGenerators[model as keyof typeof ShapeGenerators]) {
      console.warn('Model not found:', model);
      return;
    }
    this.state.currentModel = model;
    this.state.targetPositions = ShapeGenerators[model as keyof typeof ShapeGenerators](
      this.state.particleCount,
    );
  }

  setParticleCount(count: number): void {
    count = AppConfig.validate(
      count,
      AppConfig.particle.minCount,
      AppConfig.particle.maxCount,
      this.state.particleCount,
    );
    if (count === this.state.particleCount) return;

    this.state.particleCount = count;
    this.state.targetPositions = ShapeGenerators[this.state.currentModel as keyof typeof ShapeGenerators](count);

    if (this.particles) {
      this.sceneManager!.removeObject(this.particles);
      (this.particles as any)?.geometry?.dispose?.();
      (this.particles as any)?.material?.dispose?.();

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
      if (this.particles) this.sceneManager!.addObject(this.particles as any);
    }
  }

  setParticleSize(size: number): void {
    this.state.particleSize = AppConfig.validate(
      size,
      AppConfig.particle.minSize,
      AppConfig.particle.maxSize,
      this.state.particleSize,
    );
    if (this.particles) {
      this.particles.material.size = this.calcAdaptiveParticleSize(this.state.particleSize);
    }
  }

  setGestureSensitivity(sensitivity: number): void {
    this.state.gestureSensitivity = AppConfig.validate(
      sensitivity,
      AppConfig.gesture.minSensitivity,
      AppConfig.gesture.maxSensitivity,
      this.state.gestureSensitivity,
    );
    this.gestureRecognizer?.updateSensitivity(this.state.gestureSensitivity);
  }

  reset(): void {
    this.state.targetSpread = 0;
    this.state.spreadFactor = 0;
    this.state.currentModel = this.config.defaultModel;
    this.state.particleColor.set(this.config.defaultColor);

    if (this.particles) {
      (this.particles.material as any).color.set(this.config.defaultColor);
    }

    this.state.targetPositions = ShapeGenerators[this.config.defaultModel as keyof typeof ShapeGenerators](
      this.state.particleCount,
    );

    this.uiManager?.setActiveModel(this.config.defaultModel);
  }

  takeScreenshot(): void {
    this.sceneManager!.render();
    const link = document.createElement('a');
    link.download = `particle-art-${Date.now()}.png`;
    link.href = this.sceneManager!.getRenderer().domElement.toDataURL('image/png');
    link.click();
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  async startCamera(): Promise<void> {
    const videoElement = document.getElementById('video-feed') as HTMLVideoElement | null;
    if (!videoElement) {
      console.error('Video element not found');
      return;
    }

    try {
      await this.gestureRecognizer!.init(videoElement);
      await this.gestureRecognizer!.startCamera();
    } catch (e) {
      console.error('Failed to start camera:', e);
      this.uiManager?.setCameraStatus('inactive' as 'active' | 'starting' | 'inactive', '摄像头启动失败');
    }
  }

  stopCamera(): void {
    this.gestureRecognizer?.stopCamera();
  }

  start(): void {
    if (this.isRunning || this.isDestroyed) return;
    this.isRunning = true;
    this.animate();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate(currentTime = 0): void {
    if (this.isDestroyed || !this.isRunning) return;

    this.animationId = requestAnimationFrame((t) => this.animate(t));

    const frameTime = currentTime - this.lastFrameTime;
    const minFrameTime = 1000 / AppConfig.animation.targetFps;
    if (frameTime < minFrameTime) return;
    this.lastFrameTime = currentTime - (frameTime % minFrameTime);

    const delta = Math.min(this.clock.getDelta(), AppConfig.animation.maxDelta);

    this.updateFps(currentTime);
    this.updateParticles(delta);
    this.updateHandReactiveTransforms(delta);
    this.updateSword(delta);

    if (this.sceneManager!.getRenderer()) {
      performanceMonitor.recordRendererInfo((this.sceneManager?.getRenderer() ?? null) as any);
    }

    this.sceneManager?.render();
  }

  private updateFps(currentTime: number): void {
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;

      if (this.fps < 30) {
        console.warn('Low FPS detected:', this.fps);
      }
    }
  }

  private updateParticles(delta: number): void {
    if (!this.particles || !this.particles.geometry) return;
    const positions = this.particles!.geometry!.attributes.position!.array as Float32Array;
    const targets = this.state.targetPositions!;
    const count = this.state.particleCount;

    this.state.spreadFactor +=
      (this.state.targetSpread - this.state.spreadFactor) *
      Math.min(delta * AppConfig.animation.spreadLerpSpeed, 1);

    const spread = this.state.spreadFactor * this.state.gestureSensitivity;
    const lerpSpeed = Math.min(delta * AppConfig.animation.lerpSpeed, 1);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      const spreadDirX = targets[i3] !== 0 ? targets[i3] : (Math.random() - 0.5);
      const spreadDirY = targets[i3 + 1] !== 0 ? targets[i3 + 1] : (Math.random() - 0.5);
      const spreadDirZ = targets[i3 + 2] !== 0 ? targets[i3 + 2] : (Math.random() - 0.5);

      const targetX = targets[i3] + spreadDirX * spread * 3;
      const targetY = targets[i3 + 1] + spreadDirY * spread * 3;
      const targetZ = targets[i3 + 2] + spreadDirZ * spread * 3;

      (positions[i3] as number) += (targetX - positions[i3]) * lerpSpeed;
      (positions[i3 + 1] as number) += (targetY - positions[i3 + 1]) * lerpSpeed;
      (positions[i3 + 2] as number) += (targetZ - positions[i3 + 2]) * lerpSpeed;
    }

    if (this.particles?.geometry?.attributes?.position) this.particles.geometry.attributes.position.needsUpdate = true;
  }

  private updateHandReactiveTransforms(delta: number): void {
    if (!this.particles) return;

    const handActive =
      this.gestureRecognizer?.isCameraActive() &&
      this.state.handPos &&
      this.state.handPos.x !== undefined;

    if (handActive) {
      const targetX = (this.state.handPos.x - 0.5) * 4;
      const targetY = -(this.state.handPos.y - 0.5) * 4;
      const handLerpSpeed = 8 + this.state.gestureSensitivity * 7;
      this.particles.position.x += (targetX - this.particles.position.x) * delta * handLerpSpeed;
      this.particles.position.y += (targetY - this.particles.position.y) * delta * handLerpSpeed;

      this.state.handRotation +=
        (this.state.targetHandRotation - this.state.handRotation) * delta * 5;
      this.particles.rotation.y = this.state.handRotation * 1.5;
    } else {
      this.particles.position.x *= Math.pow(0.05, delta);
      this.particles.position.y *= Math.pow(0.05, delta);
      this.particles.rotation.y += delta * AppConfig.animation.rotationSpeed;
      this.state.handRotation *= Math.pow(0.1, delta);
    }
  }

  private updateSword(delta: number): void {
    if (!this.swordSystem) return;
    const elapsed = this.clock.getElapsedTime();
    this.swordSystem.update(delta, elapsed);
  }

  dispose(): void {
    this.isDestroyed = true;
    this.isRunning = false;

    performanceMonitor.stop();
    performanceMonitor.dispose();

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    this.gestureRecognizer?.dispose();
    this.swordSystem?.dispose();

    if (this.particles) {
      this.sceneManager?.removeObject(this.particles as any);
      (this.particles as any)?.geometry?.dispose();
      (this.particles.material as THREE.Material).dispose();
    }

    this.sceneManager?.dispose();
    this.uiManager?.dispose();
  }
}

export default ParticleSystem;
