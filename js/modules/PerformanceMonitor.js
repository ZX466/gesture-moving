export class PerformanceMonitor {
    constructor(config = {}) {
        this.config = {
            sampleSize: config.sampleSize || 60,
            warningThreshold: config.warningThreshold || 30,
            criticalThreshold: config.criticalThreshold || 15,
            ...config
        };

        this.metrics = {
            fps: [],
            frameTime: [],
            memoryUsage: [],
            particleCount: 0,
            drawCalls: 0,
            triangles: 0
        };

        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 60;
        this.listeners = [];
        this.isMonitoring = false;
        this.animationFrameId = null;
    }

    start() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.lastFrameTime = performance.now();
        this.monitor();
    }

    stop() {
        this.isMonitoring = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    monitor() {
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

    checkPerformance() {
        const avgFps = this.getAverageFps();

        if (avgFps < this.config.criticalThreshold) {
            this.notify({
                level: 'critical',
                message: `Critical FPS: ${avgFps.toFixed(1)}`,
                fps: avgFps,
                suggestions: this.getOptimizationSuggestions('critical')
            });
        } else if (avgFps < this.config.warningThreshold) {
            this.notify({
                level: 'warning',
                message: `Low FPS detected: ${avgFps.toFixed(1)}`,
                fps: avgFps,
                suggestions: this.getOptimizationSuggestions('warning')
            });
        }
    }

    getOptimizationSuggestions(level) {
        const suggestions = {
            warning: [
                'Consider reducing particle count',
                'Check for memory leaks',
                'Optimize animation loops'
            ],
            critical: [
                'Immediately reduce particle count',
                'Disable non-essential effects',
                'Check for infinite loops',
                'Consider using Web Workers for heavy calculations'
            ]
        };
        return suggestions[level] || [];
    }

    recordMemoryUsage() {
        if (performance.memory) {
            const usage = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };

            this.metrics.memoryUsage.push(usage);
            if (this.metrics.memoryUsage.length > this.config.sampleSize) {
                this.metrics.memoryUsage.shift();
            }

            return usage;
        }
        return null;
    }

    recordRendererInfo(renderer) {
        if (renderer && renderer.info) {
            this.metrics.drawCalls = renderer.info.render.calls;
            this.metrics.triangles = renderer.info.render.triangles;
        }
    }

    getAverageFps() {
        if (this.metrics.fps.length === 0) return 60;
        return this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length;
    }

    getAverageFrameTime() {
        if (this.metrics.frameTime.length === 0) return 16.67;
        return this.metrics.frameTime.reduce((a, b) => a + b, 0) / this.metrics.frameTime.length;
    }

    getStats() {
        return {
            fps: {
                current: this.currentFps,
                average: this.getAverageFps(),
                min: Math.min(...this.metrics.fps),
                max: Math.max(...this.metrics.fps)
            },
            frameTime: {
                average: this.getAverageFrameTime(),
                min: Math.min(...this.metrics.frameTime),
                max: Math.max(...this.metrics.frameTime)
            },
            memory: this.recordMemoryUsage(),
            renderer: {
                drawCalls: this.metrics.drawCalls,
                triangles: this.metrics.triangles
            }
        };
    }

    on(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error('[PerformanceMonitor] Listener error:', e);
            }
        });
    }

    reset() {
        this.metrics = {
            fps: [],
            frameTime: [],
            memoryUsage: [],
            particleCount: 0,
            drawCalls: 0,
            triangles: 0
        };
        this.frameCount = 0;
        this.currentFps = 60;
    }

    dispose() {
        this.stop();
        this.listeners = [];
        this.reset();
    }
}

export const performanceMonitor = new PerformanceMonitor();
