/**
 * @fileoverview Handles particle animation logic: position lerping, FPS tracking,
 * and hand-reactive transforms. Extracted from ParticleSystem for
 * single-responsibility adherence.
 */

import { AppConfig } from './Config.js';
import type { ParticleSystemState } from '../types.js';

interface GestureRecognizerRef {
  isCameraActive(): boolean;
}

interface Deps {
  state: ParticleSystemState;
  gestureRecognizer: GestureRecognizerRef;
}

export class ParticleAnimator {
  private readonly state: ParticleSystemState;
  private readonly gestureRecognizer: GestureRecognizerRef;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private fps = 0;

  constructor(deps: Deps) {
    this.state = deps.state;
    this.gestureRecognizer = deps.gestureRecognizer;
  }

  updateFps(currentTime: number): void {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateParticles(delta: number, particles: any, targets: Float32Array | null, count: number): void {
    if (!particles || !particles.geometry || !targets) return;

    const positions = particles.geometry.attributes.position.array as Float32Array;

    this.state.spreadFactor += (this.state.targetSpread - this.state.spreadFactor) *
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

    particles.geometry.attributes.position.needsUpdate = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateHandReactiveTransforms(delta: number, particles: any): void {
    if (!particles) return;

    const handActive =
      this.gestureRecognizer.isCameraActive() &&
      this.state.handPos &&
      this.state.handPos.x !== undefined;

    if (handActive) {
      const targetX = (this.state.handPos.x - 0.5) * 4;
      const targetY = -(this.state.handPos.y - 0.5) * 4;
      particles.position.x += (targetX - particles.position.x) * delta * 3;
      particles.position.y += (targetY - particles.position.y) * delta * 3;

      this.state.handRotation += (this.state.targetHandRotation - this.state.handRotation) * delta * 5;
      particles.rotation.y = this.state.handRotation * 1.5;
    } else {
      particles.position.x *= Math.pow(0.05, delta);
      particles.position.y *= Math.pow(0.05, delta);
      particles.rotation.y += delta * AppConfig.animation.rotationSpeed;
      this.state.handRotation *= Math.pow(0.1, delta);
    }
  }
}

export default ParticleAnimator;
