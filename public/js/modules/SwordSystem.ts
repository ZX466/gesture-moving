/**
 * @fileoverview 3D flying sword with blade, guard, handle, tassels,
 * and glow. Supports three states: idle (orbit), summoned (finger tip),
 * and flying (follow).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
import type { SwordConfig, SwordState } from '../types.js';

export class SwordSystem {
  private readonly scene: THREE.Scene;
  private readonly config: Required<SwordConfig>;
  private readonly state: {
    current: SwordState;
    target: THREE.Vector3;
    velocity: THREE.Vector3;
    angle: number;
    visible: boolean;
    fingerTip3D: THREE.Vector3;
    prevFingerTip3D: THREE.Vector3;
  };
  public readonly sword: THREE.Group | null = null;
  private readonly trailLine: THREE.Line | null = null;
  private readonly trailParticles: THREE.Points | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
private swordGlow: any = null;
  private readonly tassels: THREE.Mesh[] = [];
  private readonly trailPositions: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene, config: SwordConfig = {}) {
    this.scene = scene;

    this.config = {
      trailLength: config.trailLength ?? 50,
      orbitRadius: config.orbitRadius ?? 4,
      orbitSpeed: config.orbitSpeed ?? 0.8,
      flySpeed: config.flySpeed ?? 0.12,
      bobSpeed: config.bobSpeed ?? 2.0,
      bobAmplitude: config.bobAmplitude ?? 0.15,
      maxVelocity: config.maxVelocity ?? 0.5,
    };

    this.state = {
      current: 'idle',
      target: new THREE.Vector3(0, 2, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      angle: 0,
      visible: true,
      fingerTip3D: new THREE.Vector3(0, 2, 0),
      prevFingerTip3D: new THREE.Vector3(0, 2, 0),
    };

    this.sword = this.createSword();
    this.scene.add(this.sword);

    const tg = new THREE.BufferGeometry();
    tg.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.config.trailLength * 3), 3),
    );
    tg.setDrawRange(0, 0);
    this.trailLine = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({
        color: 0x60d0ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.trailLine as any);

    const pg = new THREE.BufferGeometry();
    pg.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.config.trailLength * 3), 3),
    );
    pg.setDrawRange(0, 0);
    this.trailParticles = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: 0x60d0ff,
        size: 0.08,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.trailParticles as any);

    this.swordGlow = null;
  }

  private createSword(): THREE.Group {
    const g = new THREE.Group();

    const bs = new THREE.Shape();
    bs.moveTo(0, 1.6);
    bs.quadraticCurveTo(0.12, 0.8, 0.1, 0);
    bs.lineTo(-0.1, 0);
    bs.quadraticCurveTo(-0.12, 0.8, 0, 1.6);

    const bg = new THREE.ExtrudeGeometry(bs, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    bg.center();

    const bladeMat = new THREE.MeshPhongMaterial({
      color: 0x8ec8f0,
      emissive: 0x1a4a6e,
      emissiveIntensity: 0.6,
      specular: 0xffffff,
      shininess: 200,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const blade = new THREE.Mesh(bg, bladeMat);
    blade.position.y = 0.8;
    g.add(blade);

    const eg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2.2, 0),
    ]);
    const edgeLine = new THREE.Line(
      eg,
      new THREE.LineBasicMaterial({ color: 0x60d0ff, transparent: true, opacity: 0.7 }),
    );
    edgeLine.position.y = -0.3;
    g.add(edgeLine);

    const gg = new THREE.TorusGeometry(0.22, 0.025, 8, 24);
    const guardMat = new THREE.MeshPhongMaterial({
      color: 0xd4af37,
      emissive: 0x8b6914,
      emissiveIntensity: 0.3,
      specular: 0xffffff,
      shininess: 100,
    });
    const guard = new THREE.Mesh(gg, guardMat);
    guard.rotation.x = Math.PI / 2;
    guard.position.y = -0.15;
    g.add(guard);

    const handleMat = new THREE.MeshPhongMaterial({
      color: 0x5c3317,
      emissive: 0x1a0a00,
      specular: 0x222222,
      shininess: 30,
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), handleMat);
    handle.position.y = -0.45;
    g.add(handle);

    for (let i = 0; i < 4; i++) {
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.008, 6, 12),
        new THREE.MeshPhongMaterial({
          color: 0xd4af37,
          emissive: 0x8b6914,
          emissiveIntensity: 0.2,
        }),
      );
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = -0.28 - i * 0.1;
      g.add(wrap);
    }

    const pommelMat = new THREE.MeshPhongMaterial({
      color: 0xd4af37,
      emissive: 0x8b6914,
      emissiveIntensity: 0.3,
      specular: 0xffffff,
      shininess: 80,
    });
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), pommelMat);
    pommel.position.y = -0.72;
    g.add(pommel);

    this.tassels.splice(0);
    const tc = [0xe63946, 0xd62828, 0xc1121f];
    for (let t = 0; t < 3; t++) {
      const pts = Array.from({ length: 12 }, (_, i) =>
        new THREE.Vector3((t - 1) * 0.04, -0.72 - i * 0.06, Math.cos(i * 0.7) * 0.03),
      );
      const curve = new THREE.CatmullRomCurve3(pts);
      const tasselMat = new THREE.MeshPhongMaterial({
        color: tc[t],
        emissive: tc[t],
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.9,
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6, false), tasselMat);
      (tube as THREE.Mesh & { _tIdx: number })._tIdx = t;
      g.add(tube);
      this.tassels.push(tube);
    }

    const swordLight = new THREE.PointLight(0x60d0ff, 1.5, 8);
    swordLight.position.y = 0.8;
    g.add(swordLight);
    this.swordGlow = swordLight;

    g.add(new THREE.AmbientLight(0x404060, 0.3));
    g.scale.set(0.8, 0.8, 0.8);

    return g;
  }

  setState(newState: SwordState, targetPosition: THREE.Vector3 | null = null): void {
    this.state.current = newState;
    if (targetPosition) {
      this.state.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
    }
  }

  setFingerTip3D(tip3D: THREE.Vector3, _prevTip3D: THREE.Vector3): void {
    this.state.prevFingerTip3D.copy(this.state.fingerTip3D);
    this.state.fingerTip3D.copy(tip3D);
  }

  setVisible(visible: boolean): void {
    this.state.visible = visible;
    if (this.sword) (this.sword as any).visible = visible;
    if (this.trailLine) (this.trailLine as any).visible = visible;
    if (this.trailParticles) (this.trailParticles as any).visible = visible;
  }

  update(delta: number, elapsed: number): void {
    if (!this.state.visible || !this.sword) return;

    this.updateSwordState(delta, elapsed);
    this.updateTassels(elapsed);
    this.updateGlow(delta);
    this.updateTrail();
  }

  private updateSwordState(delta: number, elapsed: number): void {
    switch (this.state.current) {
      case 'idle':
        this.updateIdleState(delta, elapsed);
        break;
      case 'summoned':
        this.updateSummonedState(delta, elapsed);
        break;
      case 'flying':
        this.updateFlyingState(delta);
        break;
    }
  }

  private updateIdleState(delta: number, elapsed: number): void {
    const s = this.sword!;
    this.state.angle += delta * this.config.orbitSpeed;

    (s.position as any).lerp(
      new THREE.Vector3(
        Math.cos(this.state.angle) * this.config.orbitRadius,
        1.5 + Math.sin(elapsed * this.config.bobSpeed) * this.config.bobAmplitude,
        Math.sin(this.state.angle) * this.config.orbitRadius,
      ),
      delta * 2,
    );

    s.lookAt(
      new THREE.Vector3(
        Math.cos(this.state.angle + 0.01) * this.config.orbitRadius,
        s.position.y,
        Math.sin(this.state.angle + 0.01) * this.config.orbitRadius,
      ),
    );
    s.rotateZ(Math.sin(elapsed * 1.5) * 0.1);
  }

  private updateSummonedState(delta: number, elapsed: number): void {
    const s = this.sword!;
    (s.position as any).lerp(this.state.target, Math.min(delta * 6, 1));

    const dir: any = (this.state.target as any).clone().sub(s.position as any);
    if (dir.length() > 0.01) {
      s.lookAt((s.position as any).clone().add(dir));
    }
    s.position.y += Math.sin(elapsed * 3) * 0.002;
  }

  private updateFlyingState(delta: number): void {
    const s = this.sword!;
    const fd = (this.state.fingerTip3D as any)
      .clone()
      .sub(s.position)
      .normalize()
      .multiplyScalar(this.config.flySpeed * 60);

    (this.state.velocity as any).lerp(fd, delta * 4);

    if ((this.state.velocity as any).length && (this.state.velocity as any).length() > this.config.maxVelocity) {
      (this.state.velocity as any).normalize().multiplyScalar(this.config.maxVelocity);
    }

    (s.position as any).add((this.state.velocity as any).clone().multiplyScalar(delta));

    if (this.state.velocity.length() > 0.01) {
      s.lookAt((s.position as any).clone().add((this.state.velocity as any).normalize()));
    }

    s.rotateZ(
      this.dist2d(
        { x: (this.state.prevFingerTip3D as any).x, y: (this.state.prevFingerTip3D as any).y },
        { x: (this.state.fingerTip3D as any).x, y: (this.state.fingerTip3D as any).y },
      ) * 2,
    );
  }

  private updateTassels(elapsed: number): void {
    this.tassels.forEach((tube, idx) => {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        pts.push(
          new THREE.Vector3(
            (idx - 1) * 0.04 + Math.sin(elapsed * 3 + i * 0.4 + idx * 2) * i * 0.015,
            -0.72 - i * 0.06,
            Math.cos(elapsed * 2.5 + i * 0.5 + idx) * i * 0.01,
          ),
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const ng = new THREE.TubeGeometry(curve, 16, 0.012, 6, false);
      (tube.geometry as THREE.BufferGeometry).dispose();
      tube.geometry = ng;
    });
  }

  private updateGlow(delta: number): void {
    if (this.swordGlow) {
      const gi =
        this.state.current === 'flying' ? 2.5 : this.state.current === 'summoned' ? 2.0 : 1.2;
      this.swordGlow.intensity += (gi - this.swordGlow.intensity) * delta * 3;
    }
  }

  private updateTrail(): void {
    if (!this.sword) return;

    this.trailPositions.push((this.sword.position as any).clone());
    if (this.trailPositions.length > this.config.trailLength) {
      this.trailPositions.shift();
    }

    const n = this.trailPositions.length;
    if (n < 2) return;

    const lp = (this.trailLine as any)?.geometry?.attributes?.position?.array as Float32Array | undefined;
    const pp = (this.trailParticles as any)?.geometry?.attributes?.position?.array as Float32Array | undefined;

    if (!lp || !pp) return;
    for (let i = 0; i < n; i++) {
      const s = ((n - i) / n) * 0.15;
      lp[i * 3] = ((this.trailPositions[i] as any) ?? { x: 0, y: 0, z: 0 }).x;
      lp[i * 3 + 1] = ((this.trailPositions[i] as any) ?? { x: 0, y: 0, z: 0 }).y;
      lp[i * 3 + 2] = ((this.trailPositions[i] as any) ?? { x: 0, y: 0, z: 0 }).z;

      pp[i * 3] = this.trailPositions[i].x + (Math.random() - 0.5) * s;
      pp[i * 3 + 1] = this.trailPositions[i].y + (Math.random() - 0.5) * s;
      pp[i * 3 + 2] = this.trailPositions[i].z + (Math.random() - 0.5) * s;
    }

    (this.trailLine as any).geometry.attributes.position.needsUpdate = true;
    (this.trailLine as any).geometry.setDrawRange(0, n);
    (this.trailParticles as any).geometry.attributes.position.needsUpdate = true;
    (this.trailParticles as any).geometry.setDrawRange(0, n);
  }

  private dist2d(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  getSword(): THREE.Group | null {
    return this.sword;
  }

  dispose(): void {
    if (this.sword) {
      this.scene.remove(this.sword);
      this.sword.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        const mat = (child as { material?: unknown }).material;
        if (mat) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      ((this.trailLine.material as any).dispose && (this.trailLine.material as any).dispose());
    }

    if (this.trailParticles) {
      this.scene.remove(this.trailParticles);
      this.trailParticles.geometry.dispose();
      (this.trailParticles.material as THREE.Material).dispose();
    }
  }
}

export default SwordSystem;
