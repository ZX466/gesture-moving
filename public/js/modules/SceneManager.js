export class SceneManager {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error("Container " + containerId + " not found");
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
        this.webglLost = false;

        this.isMobile = this.detectMobile();
        this.isPortrait = window.innerHeight > window.innerWidth;

        this.adaptiveCameraZ = this.calcAdaptiveCameraZ();
        this.adaptiveFov = this.calcAdaptiveFov();
        this.adaptivePixelRatio = this.calcAdaptivePixelRatio();

        console.log(
            "[SceneManager] mobile=" + this.isMobile +
            " portrait=" + this.isPortrait +
            " cameraZ=" + this.adaptiveCameraZ.toFixed(1) +
            " fov=" + this.adaptiveFov +
            " dpr=" + this.adaptivePixelRatio
        );

        this.init();
    }

    detectMobile() {
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ("ontouchstart" in window)
            || (navigator.maxTouchPoints > 0)
            || (window.innerWidth < 768)
        );
    }

    calcAdaptiveCameraZ() {
        if (this.isMobile && this.isPortrait) {
            return 4.5;
        } else if (this.isMobile) {
            return 6;
        }
        return this.config.cameraZ;
    }

    calcAdaptiveFov() {
        if (this.isMobile && this.isPortrait) {
            return 70;
        } else if (this.isMobile) {
            return 65;
        }
        return this.config.fov;
    }

    calcAdaptivePixelRatio() {
        var dpr = window.devicePixelRatio || 1;
        if (this.isMobile) {
            return Math.min(dpr, 1.5);
        }
        return Math.min(dpr, this.config.maxPixelRatio);
    }

    init() {
        try {
            this.scene = new THREE.Scene();
        } catch (e) {
            console.error("Failed to init Three.js scene:", e);
            throw e;
        }

        var aspect = window.innerWidth / Math.max(window.innerHeight, 1);
        this.camera = new THREE.PerspectiveCamera(this.adaptiveFov, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, this.adaptiveCameraZ);

        var glOptions = {
            antialias: !this.isMobile,
            alpha: false,
            powerPreference: this.isMobile ? "low-power" : "high-performance",
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false
        };

        try {
            this.renderer = new THREE.WebGLRenderer(glOptions);
        } catch (e) {
            console.error("Failed to create WebGL renderer:", e);
            glOptions.antialias = false;
            this.renderer = new THREE.WebGLRenderer(glOptions);
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.adaptivePixelRatio);
        this.renderer.setClearColor(this.config.backgroundColor, 1);
        this.renderer.domElement.style.position = "absolute";
        this.renderer.domElement.style.top = "0";
        this.renderer.domElement.style.left = "0";
        this.renderer.domElement.style.width = "100%";
        this.renderer.domElement.style.height = "100%";

        this.container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupResizeHandler();
        this.setupContextLossHandler();

        this.onResize();
    }

    setupLights() {
        var ambientLight = new THREE.AmbientLight(0x222244, 0.6);
        this.scene.add(ambientLight);

        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);

        var backLight = new THREE.DirectionalLight(0x334466, 0.4);
        backLight.position.set(-5, -2, -5);
        this.scene.add(backLight);
    }

    setupResizeHandler() {
        var self = this;
        var resizeTimeout;
        window.addEventListener("resize", function() {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() { self.onResize(); }, 200);
        }, { passive: true });

        if (screen && screen.orientation) {
            screen.orientation.addEventListener("change", function() {
                setTimeout(function() { self.onResize(); }, 300);
            });
        }
    }

    setupContextLossHandler() {
        var self = this;
        var canvas = this.renderer.domElement;

        canvas.addEventListener("webglcontextlost", function(e) {
            e.preventDefault();
            self.webglLost = true;
            console.warn("[SceneManager] WebGL context lost, will attempt recovery");
        }, false);

        canvas.addEventListener("webglcontextrestored", function() {
            self.webglLost = false;
            console.log("[SceneManager] WebGL context restored");
            self.onResize();
        }, false);
    }

    onResize() {
        if (this.isDestroyed || this.webglLost) return;

        this.isPortrait = window.innerHeight > window.innerWidth;
        var wasMobile = this.isMobile;
        this.isMobile = this.detectMobile();

        var width = window.innerWidth;
        var height = window.innerHeight;

        this.camera.aspect = width / Math.max(height, 1);
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);

        var newCameraZ = this.calcAdaptiveCameraZ();
        var newFov = this.calcAdaptiveFov();

        if (Math.abs(newFov - this.camera.fov) > 1) {
            this.camera.fov = newFov;
            this.camera.updateProjectionMatrix();
            this.adaptiveFov = newFov;
        }

        if (Math.abs(newCameraZ - this.adaptiveCameraZ) > 0.5) {
            this.animateCameraZ(this.adaptiveCameraZ, newCameraZ);
            this.adaptiveCameraZ = newCameraZ;
        }

        var newPixelRatio = this.calcAdaptivePixelRatio();
        if (Math.abs(newPixelRatio - this.adaptivePixelRatio) > 0.1) {
            this.adaptivePixelRatio = newPixelRatio;
            this.renderer.setPixelRatio(this.adaptivePixelRatio);
        }
    }

    animateCameraZ(fromZ, toZ) {
        var self = this;
        var startTime = performance.now();
        var duration = 400;

        function step() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            self.camera.position.z = fromZ + (toZ - fromZ) * eased;
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        console.log("[SceneManager] Camera Z: " + fromZ.toFixed(1) + " -> " + toZ.toFixed(1));
    }

    addObject(object) {
        this.scene.add(object);
    }

    removeObject(object) {
        this.scene.remove(object);
    }

    render() {
        if (!this.isDestroyed && !this.webglLost) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    getScene() { return this.scene; }
    getCamera() { return this.camera; }
    getRenderer() { return this.renderer; }
    getContainer() { return this.container; }
    getIsMobile() { return this.isMobile; }
    getAdaptiveCameraZ() { return this.adaptiveCameraZ; }

    dispose() {
        this.isDestroyed = true;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        window.removeEventListener("resize", this.onResize);

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.scene) {
            this.scene.traverse(function(object) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(function(m) { m.dispose(); });
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
}
