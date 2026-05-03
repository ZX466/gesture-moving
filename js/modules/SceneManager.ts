/**
 * @fileoverview Three.js scene, camera, and renderer management
 * with adaptive mobile/desktop rendering and WebGL context recovery.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
import type { SceneManagerConfig } from '../types.js';

export class SceneManager {
  private readonly container: HTMLElement;
  private readonly config: Required<SceneManagerConfig>;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private animationId: number | null = null;
  public isDestroyed = false;
  public webglLost = false;

  public readonly isMobile: boolean;
  private isPortrait: boolean;
  private adaptiveCameraZ: number;
  private adaptiveFov: number;
  private adaptivePixelRatio: number;

  constructor(containerId: string, config: SceneManagerConfig = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container #${containerId} not found`);
    }
    this.container = container;

    this.config = {
      fov: config.fov ?? 60,
      cameraZ: config.cameraZ ?? 10,
      backgroundColor: config.backgroundColor ?? 0x0a0e27,
      maxPixelRatio: config.maxPixelRatio ?? 2,
    };

    this.isMobile = this.detectMobile();
    this.isPortrait = window.innerHeight > window.innerWidth;

    this.adaptiveCameraZ = this.calcAdaptiveCameraZ();
    this.adaptiveFov = this.calcAdaptiveFov();
    this.adaptivePixelRatio = this.calcAdaptivePixelRatio();

    console.log(
      `[SceneManager] mobile=${this.isMobile}` +
      ` portrait=${this.isPortrait}` +
      ` cameraZ=${this.adaptiveCameraZ.toFixed(1)}` +
      ` fov=${this.adaptiveFov}` +
      ` dpr=${this.adaptivePixelRatio}`,
    );

    this.scene = null!;
    this.camera = null!;
    this.renderer = null!;

    this.init();
  }

  private detectMobile(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.innerWidth < 768)
    );
  }

  private calcAdaptiveCameraZ(): number {
    if (this.isMobile && this.isPortrait) return 4.5;
    if (this.isMobile) return 6;
    return this.config.cameraZ;
  }

  private calcAdaptiveFov(): number {
    if (this.isMobile && this.isPortrait) return 70;
    if (this.isMobile) return 65;
    return this.config.fov;
  }

  private calcAdaptivePixelRatio(): number {
    const dpr = window.devicePixelRatio || 1;
    if (this.isMobile) return Math.min(dpr, 1.5);
    return Math.min(dpr, this.config.maxPixelRatio);
  }

  private init(): void {
    try {
      this.scene = new THREE.Scene();
    } catch (e) {
      console.error('Failed to init Three.js scene:', e);
      throw e;
    }

    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(this.adaptiveFov, aspect, 0.1, 1000);
    // @ts-expect-error - position.set exists on Vector3
    this.camera.position.set(0, 0, this.adaptiveCameraZ);

    const glOptions: WebGLContextAttributes & { failIfMajorPerformanceCaveat?: boolean } = {
      antialias: !this.isMobile,
      alpha: false,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance',
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    };

    try {
      this.renderer = new THREE.WebGLRenderer(glOptions);
    } catch (e) {
      console.error('Failed to create WebGL renderer, retrying without antialias:', e);
      glOptions.antialias = false;
      this.renderer = new THREE.WebGLRenderer(glOptions);
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // @ts-expect-error - Three.js WebGLRenderer.setPixelRatio
    this.renderer.setPixelRatio(this.adaptivePixelRatio);
    // @ts-expect-error - Three.js WebGLRenderer.setClearColor
    this.renderer.setClearColor(this.config.backgroundColor, 1);

    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.container.appendChild(this.renderer.domElement);

    this.setupLights();
    this.setupResizeHandler();
    this.setupContextLossHandler();

    this.onResize();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0x222244, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x334466, 0.4);
    backLight.position.set(-5, -2, -5);
    this.scene.add(backLight);
  }

  private setupResizeHandler(): void {
    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.onResize(), 200);
    }, { passive: true });

    if (screen?.orientation) {
      screen.orientation.addEventListener('change', () => {
        setTimeout(() => this.onResize(), 300);
      });
    }
  }

  private setupContextLossHandler(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault();
      this.webglLost = true;
      console.warn('[SceneManager] WebGL context lost, will attempt recovery');
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      this.webglLost = false;
      console.log('[SceneManager] WebGL context restored');
      this.onResize();
    }, false);
  }

  private onResize(): void {
    if (this.isDestroyed || this.webglLost) return;

    this.isPortrait = window.innerHeight > window.innerWidth;
    (this as { isMobile: boolean }).isMobile = this.detectMobile();

    const width = window.innerWidth;
    const height = window.innerHeight;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.camera as any).aspect = width / Math.max(height, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.camera as any).updateProjectionMatrix();

    this.renderer.setSize(width, height);

    const newFov = this.calcAdaptiveFov();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Math.abs(newFov - (this.camera as any).fov) > 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.camera as any).fov = newFov;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.camera as any).updateProjectionMatrix();
      this.adaptiveFov = newFov;
    }

    const newCameraZ = this.calcAdaptiveCameraZ();
    if (Math.abs(newCameraZ - this.adaptiveCameraZ) > 0.5) {
      this.animateCameraZ(this.adaptiveCameraZ, newCameraZ);
      this.adaptiveCameraZ = newCameraZ;
    }

    const newPixelRatio = this.calcAdaptivePixelRatio();
    if (Math.abs(newPixelRatio - this.adaptivePixelRatio) > 0.1) {
      this.adaptivePixelRatio = newPixelRatio;
      // @ts-expect-error - Three.js WebGLRenderer.setPixelRatio
      this.renderer.setPixelRatio(this.adaptivePixelRatio);
    }
  }

  private animateCameraZ(fromZ: number, toZ: number): void {
    const startTime = performance.now();
    const duration = 400;

    const step = (): void => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.z = fromZ + (toZ - fromZ) * eased;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    console.log(`[SceneManager] Camera Z: ${fromZ.toFixed(1)} -> ${toZ.toFixed(1)}`);
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  render(): void {
    if (!this.isDestroyed && !this.webglLost) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getIsMobile(): boolean {
    return this.isMobile;
  }

  getAdaptiveCameraZ(): number {
    return this.adaptiveCameraZ;
  }

  dispose(): void {
    this.isDestroyed = true;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement?.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    // @ts-expect-error - Three.js Scene.traverse
    this.scene?.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m: any) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}

export default SceneManager;
