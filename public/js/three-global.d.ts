// Global type declarations for Three.js r128 (loaded from CDN)
// THREE is available as a global variable at runtime

declare class Vector3 {
  constructor(x?: number, y?: number, z?: number);
  x: number; y: number; z: number;
  clone(): Vector3;
  copy(v: Vector3): Vector3;
  set(x: number, y: number, z: number): this;
  sub(v: Vector3): Vector3;
  normalize(): Vector3;
  multiplyScalar(s: number): Vector3;
  length(): number;
  lerp(v: Vector3, alpha: number): Vector3;
  add(v: Vector3): Vector3;
  lookAt(v: Vector3): void;
}

declare class Scene {
  add(obj: object): void;
  remove(obj: object): void;
}

declare class PerspectiveCamera {
  constructor(fov: number, aspect: number, near: number, far: number);
  position: { x: number; y: number; z: number };
  lookAt(v: Vector3): void;
}

declare class WebGLRenderer {
  constructor(opts?: object);
  domElement: HTMLCanvasElement;
  setSize(w: number, h: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

declare class Object3D {
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  add(obj: object): void; remove(obj: object): void;
  lookAt(v: Vector3): void; rotateZ(rad: number): void;
  traverse(fn: (obj: object) => void): void;
}

declare class Points extends Object3D {
  geometry: BufferGeometry; material: Material;
}
declare class Mesh extends Object3D {
  geometry: BufferGeometry; material: Material | Material[];
}
declare class Line extends Object3D {
  geometry: BufferGeometry; material: LineBasicMaterial;
}
declare class Group extends Object3D {}

declare class BufferGeometry {
  setAttribute(name: string, attr: BufferAttribute): void;
  get attributes(): { position?: BufferAttribute };
  setDrawRange(start: number, count: number): void;
  dispose(): void;
}
declare class BufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number);
  array: ArrayLike<number>; itemSize: number;
  needsUpdate: boolean;
}
declare class Clock { constructor(); getDelta(): number; getElapsedTime(): number; }

interface Material {
  color?: Color; size?: number; transparent?: boolean; opacity?: number;
  blending?: number; depthWrite?: boolean; sizeAttenuation?: boolean;
  dispose(): void;
}
declare class Color { constructor(value?: string | number); set(value: string | number): this; }
declare class PointsMaterial implements Material { color: Color; size: number; transparent?: boolean; opacity?: number; blending?: number; depthWrite?: boolean; sizeAttenuation?: boolean; constructor(opts?: object); }
declare class LineBasicMaterial implements Material { color: number; transparent?: boolean; opacity?: number; blending?: number; constructor(opts?: object); }
declare class MeshPhongMaterial implements Material { color: number; emissive: number; emissiveIntensity: number; specular: number; shininess: number; transparent?: boolean; opacity?: number; side?: number; constructor(opts?: object); }

declare const DoubleSide: number;
declare const AdditiveBlending: number;

declare class Shape { constructor(); }
declare class ExtrudeGeometry { constructor(shape: Shape, opts: object); }
declare class TorusGeometry { constructor(r: number, t: number, rSeg: number, arc: number); }
declare class CylinderGeometry { constructor(rt: number, rb: number, h: number, s: number); }
declare class SphereGeometry { constructor(r: number, ws: number, hs: number); }
declare class TubeGeometry { constructor(curve: object, t: number, r: number, s: number, c: boolean); }
declare class CatmullRomCurve3 { constructor(pts: Vector3[]); }
declare const BufferGeometry: { new (): BufferGeometry; prototype: BufferGeometry; };

declare class PointLight { constructor(color: number, intensity?: number, distance?: number); position: Object3D['position']; intensity: number; }
declare class AmbientLight { constructor(color: number, intensity?: number); }

// THREE global
declare namespace THREE {
  type Vector3 = globalThis.Vector3;
  type Scene = globalThis.Scene;
  type PerspectiveCamera = globalThis.PerspectiveCamera;
  type WebGLRenderer = globalThis.WebGLRenderer;
  type Object3D = globalThis.Object3D;
  type Points = globalThis.Points;
  type Mesh = globalThis.Mesh;
  type Line = globalThis.Line;
  type Group = globalThis.Group;
  type BufferGeometry = globalThis.BufferGeometry;
  type BufferAttribute = globalThis.BufferAttribute;
  type Clock = globalThis.Clock;
  type Material = globalThis.Material;
  type Color = globalThis.Color;
  type PointsMaterial = globalThis.PointsMaterial;
  type LineBasicMaterial = globalThis.LineBasicMaterial;
  type MeshPhongMaterial = globalThis.MeshPhongMaterial;
  const DoubleSide: number; const AdditiveBlending: number;
  type Shape = globalThis.Shape;
  type ExtrudeGeometry = globalThis.ExtrudeGeometry;
  type TorusGeometry = globalThis.TorusGeometry;
  type CylinderGeometry = globalThis.CylinderGeometry;
  type SphereGeometry = globalThis.SphereGeometry;
  type TubeGeometry = globalThis.TubeGeometry;
  type CatmullRomCurve3 = globalThis.CatmullRomCurve3;
  const BufferGeometry: { new (): BufferGeometry; prototype: BufferGeometry; };
  type PointLight = globalThis.PointLight;
  type AmbientLight = globalThis.AmbientLight;
}

declare const THREE: typeof import('./three-global');
