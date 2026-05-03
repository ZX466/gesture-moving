// Type stub for Three.js r128 (loaded from CDN at runtime)
// Provides TypeScript types only - THREE is a global variable at runtime

export class Vector3 {
  constructor(x?: number, y?: number, z?: number);
  x: number; y: number; z: number;
  clone(): Vector3; copy(v: Vector3): this;
  set(x: number, y: number, z: number): this;
  sub(v: Vector3): Vector3; normalize(): Vector3;
  multiplyScalar(s: number): Vector3; length(): number;
  lerp(v: Vector3, alpha: number): this;
  add(v: Vector3): Vector3; sub(v: Vector3): Vector3;
  lookAt(v: Vector3): void;
}

export class Object3D {
  position: Vector3; rotation: Vector3; scale: Vector3; visible: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(obj: any): void; remove(obj: any): void;
  lookAt(v: Vector3): void; rotateZ(rad: number): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traverse(fn: (obj: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry?: any; // eslint-disable-next-line @typescript-eslint/no-explicit-any
  material?: any;
}

export class Scene extends Object3D {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traverse(fn: (obj: any) => void): void;
}

export class PerspectiveCamera extends Object3D {
  constructor(fov: number, aspect: number, near: number, far: number);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aspect: number;
  updateProjectionMatrix(): void;
}

export class WebGLRenderer extends Object3D {
  constructor(opts?: object);
  domElement: HTMLCanvasElement;
  setSize(w: number, h: number): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPixelRatio(v: number): void;
  setClearColor(color: number | string, opacity?: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
  info: { render: { calls: number; triangles: number } };
}

export class BufferGeometry {
  setAttribute(name: string, attr: BufferAttribute): void;
  setDrawRange(start: number, count: number): void;
  dispose(): void;
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  get attributes(): Record<string, BufferAttribute>;
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  static setFromPoints(pts: Vector3[]): BufferGeometry;
}

export class BufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number);
  array: ArrayLike<number>; itemSize: number; needsUpdate: boolean;
}

export class Clock {
  constructor();
  getDelta(): number; getElapsedTime(): number;
}

export interface Material {
  dispose(): void;
}

export class Color {
  constructor(value?: string | number);
  set(value: string | number): this;
  r: number; g: number; b: number;
}

export class PointsMaterial implements Material {
  color: Color; size: number;
  transparent?: boolean; opacity?: number;
  blending?: number; depthWrite?: boolean; sizeAttenuation?: boolean;
  constructor(opts?: object); dispose(): void;
}

export class LineBasicMaterial implements Material {
  color: number; transparent?: boolean; opacity?: number; blending?: number;
  constructor(opts?: object); dispose(): void;
}

export class MeshPhongMaterial implements Material {
  color: number; emissive: number; emissiveIntensity: number;
  specular: number; shininess: number;
  transparent?: boolean; opacity?: number; side?: number;
  constructor(opts?: object); dispose(): void;
}

export const DoubleSide: number;
export const AdditiveBlending: number;

export class Shape {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
}

export class ExtrudeGeometry {
  constructor(shape: Shape, opts: object);
  center(): void;
}

export class TorusGeometry { constructor(r: number, t: number, rSeg: number, arc: number); }
export class CylinderGeometry { constructor(rt: number, rb: number, h: number, s: number); }
export class SphereGeometry { constructor(r: number, ws: number, hs: number); }
export class TubeGeometry { constructor(curve: object, t: number, r: number, s: number, c: boolean); }
export class CatmullRomCurve3 { constructor(pts: Vector3[]); }
export class DirectionalLight { constructor(color: number, intensity?: number); position: Vector3; }
export class PointLight extends Object3D {
  constructor(color: number, intensity?: number, distance?: number);
  intensity: number;
}
export class AmbientLight extends Object3D {
  constructor(color: number, intensity?: number);
}
export class Points extends Object3D {
  geometry: BufferGeometry; material: Material;
}
export class Mesh extends Object3D {
  geometry: BufferGeometry; material: Material | Material[];
}
export class Line extends Object3D {
  geometry: BufferGeometry; material: Material;
}
export class Group extends Object3D {}
