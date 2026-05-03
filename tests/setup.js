// Minimal THREE.js mock for unit testing
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

globalThis.THREE = {
  Vector3,
  Scene: class Scene {},
  PerspectiveCamera: class PerspectiveCamera { position = new Vector3(); },
  WebGLRenderer: class WebGLRenderer { domElement = {}; },
  Points: class Points {},
  PointsMaterial: class PointsMaterial {},
  BufferGeometry: class BufferGeometry {},
  BufferAttribute: class BufferAttribute {},
  Color: class Color { set() {} },
  Clock: class Clock { getDelta() { return 0.016; } getElapsedTime() { return 0; } },
  AmbientLight: class AmbientLight {},
  DirectionalLight: class DirectionalLight { position = new Vector3(); },
  AdditiveBlending: 2,
  Material: class Material { dispose() {} },
};

globalThis.Hands = undefined;
