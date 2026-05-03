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

        this.init();
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
        this.camera.position.set(0, 0, this.config.cameraZ);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.maxPixelRatio));
        this.renderer.setClearColor(this.config.backgroundColor, 1);
        this.container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupResizeHandler();
    }

    setupLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => this.onResize(), { passive: true });
    }

    onResize() {
        if (this.isDestroyed) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
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