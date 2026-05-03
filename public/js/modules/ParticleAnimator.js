import { AppConfig } from './Config.js';

/**
 * Handles particle animation logic: position lerping, FPS tracking,
 * and hand-reactive transforms. Extracted from ParticleSystem for
 * single-responsibility adherence.
 */
export class ParticleAnimator {
    /**
     * @param {Object} deps - External dependencies
     * @param {Object} deps.state - Shared particle system state (mutated in-place)
     * @param {Object} deps.gestureRecognizer - GestureRecognizer instance for hand tracking
     */
    constructor(deps) {
        this.state = deps.state;
        this.gestureRecognizer = deps.gestureRecognizer;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;
    }

    updateFps(currentTime) {
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

    updateParticles(delta, particles, targets, count) {
        if (!particles || !particles.geometry) return;

        const positions = particles.geometry.attributes.position.array;

        this.state.spreadFactor += (this.state.targetSpread - this.state.spreadFactor) * Math.min(delta * AppConfig.animation.spreadLerpSpeed, 1);

        const spread = this.state.spreadFactor * this.state.gestureSensitivity;
        const lerpSpeed = Math.min(delta * AppConfig.animation.lerpSpeed, 1);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            const spreadDir_x = targets[i3] !== 0 ? targets[i3] : (Math.random() - 0.5);
            const spreadDir_y = targets[i3 + 1] !== 0 ? targets[i3 + 1] : (Math.random() - 0.5);
            const spreadDir_z = targets[i3 + 2] !== 0 ? targets[i3 + 2] : (Math.random() - 0.5);

            const targetX = targets[i3] + spreadDir_x * spread * 3;
            const targetY = targets[i3 + 1] + spreadDir_y * spread * 3;
            const targetZ = targets[i3 + 2] + spreadDir_z * spread * 3;

            positions[i3] += (targetX - positions[i3]) * lerpSpeed;
            positions[i3 + 1] += (targetY - positions[i3 + 1]) * lerpSpeed;
            positions[i3 + 2] += (targetZ - positions[i3 + 2]) * lerpSpeed;
        }

        particles.geometry.attributes.position.needsUpdate = true;
    }

    updateHandReactiveTransforms(delta, particles) {
        if (!particles) return;

        const handActive = this.gestureRecognizer && this.gestureRecognizer.isCameraActive() &&
            this.state.handPos && this.state.handPos.x !== undefined;

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
