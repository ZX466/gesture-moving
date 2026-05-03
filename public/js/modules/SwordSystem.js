/**
 * @typedef {Object} SwordSystemConfig
 * @property {number} [trailLength=50]
 * @property {number} [orbitRadius=4]
 * @property {number} [orbitSpeed=0.8]
 * @property {number} [flySpeed=0.12]
 * @property {number} [bobSpeed=2.0]
 * @property {number} [bobAmplitude=0.15]
 * @property {number} [maxVelocity=0.5]
 */

/**
 * @typedef {'idle' | 'summoned' | 'flying'} SwordState
 */

/**
 * 3D flying sword with blade, guard, handle, tassels, and glow.
 * States: idle (orbit) → summoned (finger tip) → flying (follow)
 */
export class SwordSystem {
    constructor(scene, config = {}) {
        this.scene = scene;

        this.config = {
            trailLength: config.trailLength || 50,
            orbitRadius: config.orbitRadius || 4,
            orbitSpeed: config.orbitSpeed || 0.8,
            flySpeed: config.flySpeed || 0.12,
            bobSpeed: config.bobSpeed || 2.0,
            bobAmplitude: config.bobAmplitude || 0.15,
            maxVelocity: config.maxVelocity || 0.5,
            ...config
        };

        this.state = {
            current: 'idle',
            target: new THREE.Vector3(0, 2, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            angle: 0,
            visible: true,
            fingerTip3D: new THREE.Vector3(0, 2, 0),
            prevFingerTip3D: new THREE.Vector3(0, 2, 0)
        };

        this.sword = null;
        this.trailLine = null;
        this.trailParticles = null;
        this.swordGlow = null;
        this.tassels = [];
        this.trailPositions = [];
        this.tasselPoints = [];
        this.tasselCurves = [];

        this.init();
    }

    init() {
        this.sword = this.createSword();
        this.scene.add(this.sword);

        this.createTrail();
    }

    createSword() {
        const g = new THREE.Group();

        const bs = new THREE.Shape();
        bs.moveTo(0, 1.6);
        bs.quadraticCurveTo(0.12, 0.8, 0.10, 0);
        bs.lineTo(-0.10, 0);
        bs.quadraticCurveTo(-0.12, 0.8, 0, 1.6);
        const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
        bg.center();
        const bm = new THREE.MeshPhongMaterial({ color: 0x8ec8f0, emissive: 0x1a4a6e, emissiveIntensity: 0.6, specular: 0xffffff, shininess: 200, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
        const blade = new THREE.Mesh(bg, bm);
        blade.position.y = 0.8;
        g.add(blade);

        const eg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.2, 0)]);
        g.add(new THREE.Line(eg, new THREE.LineBasicMaterial({ color: 0x60d0ff, transparent: true, opacity: 0.7 })));
        g.children[g.children.length - 1].position.y = -0.3;

        const gg = new THREE.TorusGeometry(0.22, 0.025, 8, 24);
        const gm = new THREE.MeshPhongMaterial({ color: 0xd4af37, emissive: 0x8b6914, emissiveIntensity: 0.3, specular: 0xffffff, shininess: 100 });
        const guard = new THREE.Mesh(gg, gm);
        guard.rotation.x = Math.PI / 2;
        guard.position.y = -0.15;
        g.add(guard);

        const hm = new THREE.MeshPhongMaterial({ color: 0x5c3317, emissive: 0x1a0a00, specular: 0x222222, shininess: 30 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), hm);
        handle.position.y = -0.45;
        g.add(handle);

        for (let i = 0; i < 4; i++) {
            const w = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 12), new THREE.MeshPhongMaterial({ color: 0xd4af37, emissive: 0x8b6914, emissiveIntensity: 0.2 }));
            w.rotation.x = Math.PI / 2;
            w.position.y = -0.28 - i * 0.1;
            g.add(w);
        }

        const pm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshPhongMaterial({ color: 0xd4af37, emissive: 0x8b6914, emissiveIntensity: 0.3, specular: 0xffffff, shininess: 80 }));
        pm.position.y = -0.72;
        g.add(pm);

        this.tassels = [];
        this.tasselPoints = [];
        this.tasselCurves = [];
        const tc = [0xe63946, 0xd62828, 0xc1121f];
        for (let t = 0; t < 3; t++) {
            const pts = Array.from({ length: 12 }, (_, i) => new THREE.Vector3((t - 1) * 0.04, -0.72 - i * 0.06, Math.cos(i * 0.7) * 0.03));
            this.tasselPoints.push(pts);
            const curve = new THREE.CatmullRomCurve3(pts);
            this.tasselCurves.push(curve);
            const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6, false), new THREE.MeshPhongMaterial({ color: tc[t], emissive: tc[t], emissiveIntensity: 0.15, transparent: true, opacity: 0.9 }));
            tube._tIdx = t;
            g.add(tube);
            this.tassels.push(tube);
        }

        const sl = new THREE.PointLight(0x60d0ff, 1.5, 8);
        sl.position.y = 0.8;
        g.add(sl);
        this.swordGlow = sl;

        g.add(new THREE.AmbientLight(0x404060, 0.3));
        g.scale.set(0.8, 0.8, 0.8);

        return g;
    }

    createTrail() {
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.config.trailLength * 3), 3));
        tg.setDrawRange(0, 0);
        this.trailLine = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x60d0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
        this.scene.add(this.trailLine);

        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.config.trailLength * 3), 3));
        pg.setDrawRange(0, 0);
        this.trailParticles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x60d0ff, size: 0.08, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
        this.scene.add(this.trailParticles);
    }

    setState(newState, targetPosition = null) {
        this.state.current = newState;
        if (targetPosition) {
            this.state.target.copy(targetPosition);
        }
    }

    setFingerTip3D(tip3D, prevTip3D) {
        this.state.prevFingerTip3D.copy(this.state.fingerTip3D);
        this.state.fingerTip3D.copy(tip3D);
    }

    setVisible(visible) {
        this.state.visible = visible;
        if (this.sword) this.sword.visible = visible;
        if (this.trailLine) this.trailLine.visible = visible;
        if (this.trailParticles) this.trailParticles.visible = visible;
    }

    update(delta, elapsed) {
        if (!this.state.visible || !this.sword) return;

        this.updateSwordState(delta, elapsed);
        this.updateTassels(elapsed);
        this.updateGlow(delta);
        this.updateTrail();
    }

    updateSwordState(delta, elapsed) {
        const s = this.sword;

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

    updateIdleState(delta, elapsed) {
        const s = this.sword;
        this.state.angle += delta * this.config.orbitSpeed;

        s.position.lerp(new THREE.Vector3(
            Math.cos(this.state.angle) * this.config.orbitRadius,
            1.5 + Math.sin(elapsed * this.config.bobSpeed) * this.config.bobAmplitude,
            Math.sin(this.state.angle) * this.config.orbitRadius
        ), delta * 2);

        s.lookAt(new THREE.Vector3(
            Math.cos(this.state.angle + 0.01) * this.config.orbitRadius,
            s.position.y,
            Math.sin(this.state.angle + 0.01) * this.config.orbitRadius
        ));
        s.rotateZ(Math.sin(elapsed * 1.5) * 0.1);
    }

    updateSummonedState(delta, elapsed) {
        const s = this.sword;
        s.position.lerp(this.state.target, Math.min(delta * 6, 1));

        const dir = this.state.target.clone().sub(s.position);
        if (dir.length() > 0.01) {
            s.lookAt(s.position.clone().add(dir));
        }
        s.position.y += Math.sin(elapsed * 3) * 0.002;
    }

    updateFlyingState(delta) {
        const s = this.sword;
        const fd = this.state.fingerTip3D.clone().sub(s.position).normalize().multiplyScalar(this.config.flySpeed * 60);

        this.state.velocity.lerp(fd, delta * 4);

        if (this.state.velocity.length() > this.config.maxVelocity) {
            this.state.velocity.normalize().multiplyScalar(this.config.maxVelocity);
        }

        s.position.add(this.state.velocity.clone().multiplyScalar(delta));

        if (this.state.velocity.length() > 0.01) {
            s.lookAt(s.position.clone().add(this.state.velocity.normalize()));
        }

        s.rotateZ(this.dist2d(
            { x: this.state.prevFingerTip3D.x, y: this.state.prevFingerTip3D.y },
            { x: this.state.fingerTip3D.x, y: this.state.fingerTip3D.y }
        ) * 2);
    }

    updateTassels(elapsed) {
        for (let idx = 0; idx < this.tasselPoints.length; idx++) {
            const pts = this.tasselPoints[idx];
            for (let i = 0; i < pts.length; i++) {
                pts[i].set(
                    (idx - 1) * 0.04 + Math.sin(elapsed * 3 + i * 0.4 + idx * 2) * i * 0.015,
                    -0.72 - i * 0.06,
                    Math.cos(elapsed * 2.5 + i * 0.5 + idx) * i * 0.01
                );
            }
            this.tasselCurves[idx].updateArcLengths();
        }
    }

    updateGlow(delta) {
        if (this.swordGlow) {
            const gi = this.state.current === 'flying' ? 2.5 : this.state.current === 'summoned' ? 2.0 : 1.2;
            this.swordGlow.intensity += (gi - this.swordGlow.intensity) * delta * 3;
        }
    }

    updateTrail() {
        if (!this.sword) return;

        this.trailPositions.push(this.sword.position.clone());
        if (this.trailPositions.length > this.config.trailLength) {
            this.trailPositions.shift();
        }

        const n = this.trailPositions.length;
        if (n < 2) return;

        const lp = this.trailLine.geometry.attributes.position.array;
        const pp = this.trailParticles.geometry.attributes.position.array;

        for (let i = 0; i < n; i++) {
            lp[i * 3] = this.trailPositions[i].x;
            lp[i * 3 + 1] = this.trailPositions[i].y;
            lp[i * 3 + 2] = this.trailPositions[i].z;

            const s = (n - i) / n * 0.15;
            pp[i * 3] = this.trailPositions[i].x + (Math.random() - 0.5) * s;
            pp[i * 3 + 1] = this.trailPositions[i].y + (Math.random() - 0.5) * s;
            pp[i * 3 + 2] = this.trailPositions[i].z + (Math.random() - 0.5) * s;
        }

        this.trailLine.geometry.attributes.position.needsUpdate = true;
        this.trailLine.geometry.setDrawRange(0, n);
        this.trailParticles.geometry.attributes.position.needsUpdate = true;
        this.trailParticles.geometry.setDrawRange(0, n);
    }

    dist2d(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    getSword() {
        return this.sword;
    }

    dispose() {
        if (this.sword) {
            this.scene.remove(this.sword);
            this.sword.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        if (this.trailLine) {
            this.scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailLine.material.dispose();
        }

        if (this.trailParticles) {
            this.scene.remove(this.trailParticles);
            this.trailParticles.geometry.dispose();
            this.trailParticles.material.dispose();
        }
    }
}