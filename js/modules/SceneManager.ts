/**
 * @fileoverview Three.js scene, camera, and renderer management.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
import type { SceneManagerConfig } from '../types.js';

export class SceneManager {
  private readonly container: HTMLElement;
  private readonly config: Required<SceneManagerConfig>;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private animationId: number | null = null;
  public isDestroyed = false;

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

    this.scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.config.fov,
      aspect,
      0.1,
      1000,
    );
    // @ts-expect-error - position.set exists on Vector3
this.camera.position.set(0, 0, this.config.cameraZ);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // @ts-expect-error - Three.js WebGLRenderer.setPixelRatio
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.config.maxPixelRatio),
    );
    // @ts-expect-error - Three.js WebGLRenderer.setClearColor
    this.renderer.setClearColor(this.config.backgroundColor, 1);
    this.container.appendChild(this.renderer.domElement);

    this.setupLights();
    this.setupResizeHandler();
  }

  private setupLights(): void {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => this.onResize(), {
      passive: true,
    });
  }

  private onResize(): void {
    if (this.isDestroyed) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    (this.camera as any).aspect = width / height;
    
    (this.camera as any).updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  render(): void {
    if (!this.isDestroyed) {
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

  dispose(): void {
    this.isDestroyed = true;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener('resize', () => this.onResize());

    if (this.renderer) {
      this.renderer.dispose();
      if (
        this.renderer.domElement.parentNode &&
        this.container.contains(this.renderer.domElement)
      ) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    // @ts-expect-error - Three.js Scene.traverse
    this.scene.traverse((object: any) => {
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
