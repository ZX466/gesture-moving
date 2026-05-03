export class SceneManager {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} not found`);
        }

        this.config = {
            fov: config.fov || 60,
            cameraZ: config.cameraZ || 10,
            backgroundColor: config.backgroundColor || 0x0a0e27,
            maxPixelRatio: config.maxPixelRatio || 2,
            ...config
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;
        this.isDestroyed = false;

        // 设备检测
        this.isMobile = this.detectMobile();
        this.isPortrait = window.innerHeight > window.innerWidth;

        // 根据设备自适应参数
        this.adaptiveCameraZ = this.calcAdaptiveCameraZ();
        this.adaptivePixelRatio = this.calcAdaptivePixelRatio();

        console.log(`[SceneManager] Device: mobile=${this.isMobile}, portrait=${this.isPortrait}, cameraZ=${this.adaptiveCameraZ.toFixed(1)}, pixelRatio=${this.adaptivePixelRatio}`);

        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (navigator.maxTouchPoints > 0)
            || (window.innerWidth < 768);
    }

    calcAdaptiveCameraZ() {
        const aspect = window.innerWidth / window.innerHeight;
        if (this.isMobile && this.isPortrait) {
            // 竖屏手机：拉近相机让粒子更大
            return Math.max(4, Math.min(6, 5));
        } else if (this.isMobile) {
            // 横屏手机/平板
            return Math.max(6, Math.min(8, 7));
        } else {
            // 桌面端
            return this.config.cameraZ;
        }
    }

    calcAdaptivePixelRatio() {
        const dpr = window.devicePixelRatio || 1;
        if (this.isMobile) {
            // 移动端限制 DPR 以提升性能
            return Math.min(dpr, Math.min(this.config.maxPixelRatio, 2));
        }
        return Math.min(dpr, this.config.maxPixelRatio);
    }

    init() {
        try {
            this.scene = new THREE.Scene();
        } catch (e) {
            console.error('Failed to init Three.js scene:', e);
            throw e;
        }

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            this.config.fov,
            aspect,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, this.adaptiveCameraZ);

        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.isMobile,
            alpha: true,
            powerPreference: this.isMobile ? 'default' : 'high-performance',
            preserveDrawingBuffer: false,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.adaptivePixelRatio);
        this.renderer.setClearColor(this.config.backgroundColor, 1);

        // 移动端优化渲染设置
        if (this.isMobile) {
            this.renderer.setClearColor(this.config.backgroundColor, 1);
        }

        this.container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupResizeHandler();

        // 初始 resize 确保正确尺寸
        this.onResize();
    }

    setupLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);
    }

    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.onResize(), 100);
        }, { passive: true });

        // 监听屏幕方向变化
        if (screen?.orientation) {
            screen.orientation.addEventListener('change', () => {
                setTimeout(() => this.onResize(), 200);
            });
        }
    }

    onResize() {
        if (this.isDestroyed) return;

        // 更新设备状态
        this.isPortrait = window.innerHeight > window.innerWidth;
        const wasMobile = this.isMobile;
        this.isMobile = this.detectMobile();

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);

        // 动态调整相机距离（当方向改变时）
        const newCameraZ = this.calcAdaptiveCameraZ();
        if (Math.abs(newCameraZ - this.adaptiveCameraZ) > 0.5) {
            this.adaptiveCameraZ = newCameraZ;
            // 平滑过渡相机位置
            const targetZ = this.adaptiveCameraZ;
            const startZ = this.camera.position.z;
            const startTime = performance.now();
            const duration = 500;

            const animateCamera = () => {
                const elapsed = performance.now() - startTime;
                const t = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
                this.camera.position.z = startZ + (targetZ - startZ) * eased;
                if (t < 1) requestAnimationFrame(animateCamera);
            };
            animateCamera();
            console.log(`[SceneManager] Camera Z adjusted to: ${targetZ}`);
        }

        // 动态调整像素比
        const newPixelRatio = this.calcAdaptivePixelRatio();
        if (Math.abs(newPixelRatio - this.adaptivePixelRatio) > 0.1) {
            this.adaptivePixelRatio = newPixelRatio;
            this.renderer.setPixelRatio(this.adaptivePixelRatio);
        }
    }

    addObject(object) {
        this.scene.add(object);
    }

    removeObject(object) {
        this.scene.remove(object);
    }

    render() {
        if (!this.isDestroyed) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }

    getContainer() {
        return this.container;
    }

    getIsMobile() {
        return this.isMobile;
    }

    getAdaptiveCameraZ() {
        return this.adaptiveCameraZ;
    }

    dispose() {
        this.isDestroyed = true;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        window.removeEventListener('resize', () => this.onResize());

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
}
