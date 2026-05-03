/**
 * @fileoverview Real-time performance monitoring for FPS, frame time,
 * memory usage, and WebGL renderer statistics.
 */

import type {
  PerformanceAlert,
  PerformanceListener,
  PerformanceMetrics,
  PerformanceMonitorConfig,
  PerformanceStats,
} from '../types.js';

export class PerformanceMonitor {
  private readonly config: Required<PerformanceMonitorConfig>;
  private metrics: PerformanceMetrics = {
    fps: [],
    frameTime: [],
    memoryUsage: [],
    particleCount: 0,
    drawCalls: 0,
    triangles: 0,
  };
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 60;
  private readonly listeners: PerformanceListener[] = [];
  private isMonitoring = false;
  private animationFrameId: number | null = null;

  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      sampleSize: config.sampleSize ?? 60,
      warningThreshold: config.warningThreshold ?? 30,
      criticalThreshold: config.criticalThreshold ?? 15,
    };
  }

  start(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.monitor();
  }

  stop(): void {
    this.isMonitoring = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private monitor(): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      this.metrics.fps.push(this.currentFps);
      if (this.metrics.fps.length > this.config.sampleSize) {
        this.metrics.fps.shift();
      }

      this.checkPerformance();
    }

    this.metrics.frameTime.push(frameTime);
    if (this.metrics.frameTime.length > this.config.sampleSize) {
      this.metrics.frameTime.shift();
    }

    this.animationFrameId = requestAnimationFrame(() => this.monitor());
  }

  private checkPerformance(): void {
    const avgFps = this.getAverageFps();

    if (avgFps < this.config.criticalThreshold) {
      this.notify({
        level: 'critical',
        message: `Critical FPS: ${avgFps.toFixed(1)}`,
        fps: avgFps,
        suggestions: this.getOptimizationSuggestions('critical'),
      });
    } else if (avgFps < this.config.warningThreshold) {
      this.notify({
        level: 'warning',
        message: `Low FPS detected: ${avgFps.toFixed(1)}`,
        fps: avgFps,
        suggestions: this.getOptimizationSuggestions('warning'),
      });
    }
  }

  private getOptimizationSuggestions(
    level: 'warning' | 'critical',
  ): string[] {
    const suggestions = {
      warning: [
        'Consider reducing particle count',
        'Check for memory leaks',
        'Optimize animation loops',
      ],
      critical: [
        'Immediately reduce particle count',
        'Disable non-essential effects',
        'Check for infinite loops',
        'Consider using Web Workers for heavy calculations',
      ],
    };
    return suggestions[level] ?? [];
  }

  recordMemoryUsage(): PerformanceMetrics['memoryUsage'][0] | null {
    // @ts-expect-error - performance.memory is non-standard
const memory = performance.memory;
    if (!memory) return null;

    const usage: PerformanceMetrics['memoryUsage'][0] = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now(),
    };

    this.metrics.memoryUsage.push(usage);
    if (this.metrics.memoryUsage.length > this.config.sampleSize) {
      this.metrics.memoryUsage.shift();
    }

    return usage;
  }

  recordRendererInfo(renderer: { info?: { render?: { calls?: number; triangles?: number } } } | null): void {
    if (renderer?.info?.render) {
      this.metrics.drawCalls = renderer.info.render.calls ?? 0;
      this.metrics.triangles = renderer.info.render.triangles ?? 0;
    }
  }

  getAverageFps(): number {
    if (this.metrics.fps.length === 0) return 60;
    return this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length;
  }

  getAverageFrameTime(): number {
    if (this.metrics.frameTime.length === 0) return 16.67;
    return (
      this.metrics.frameTime.reduce((a, b) => a + b, 0) /
      this.metrics.frameTime.length
    );
  }

  getStats(): PerformanceStats {
    return {
      fps: {
        current: this.currentFps,
        average: this.getAverageFps(),
        min: this.metrics.fps.length > 0 ? Math.min(...this.metrics.fps) : 60,
        max: this.metrics.fps.length > 0 ? Math.max(...this.metrics.fps) : 60,
      },
      frameTime: {
        average: this.getAverageFrameTime(),
        min:
          this.metrics.frameTime.length > 0
            ? Math.min(...this.metrics.frameTime)
            : 16.67,
        max:
          this.metrics.frameTime.length > 0
            ? Math.max(...this.metrics.frameTime)
            : 16.67,
      },
      memory: this.recordMemoryUsage(),
      renderer: {
        drawCalls: this.metrics.drawCalls,
        triangles: this.metrics.triangles,
      },
    };
  }

  on(callback: PerformanceListener): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback); if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  private notify(data: PerformanceAlert): void {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error('[PerformanceMonitor] Listener error:', e);
      }
    });
  }

  reset(): void {
    this.metrics = {
      fps: [],
      frameTime: [],
      memoryUsage: [],
      particleCount: 0,
      drawCalls: 0,
      triangles: 0,
    };
    this.frameCount = 0;
    this.currentFps = 60;
  }

  dispose(): void {
    this.stop();
    this.listeners.splice(0, this.listeners.length);
    this.reset();
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
