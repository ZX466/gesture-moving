/**
 * @typedef {{
 *   PARTICLE_COUNT_MIN: number,
 *   PARTICLE_COUNT_MAX: number
 * }} ShapeConfig
 */

/**
 * @typedef {(count: number) => Float32Array} ShapeGeneratorFn
 */

export const SHAPE_CONFIG = {
    PARTICLE_COUNT_MIN: 100,
    PARTICLE_COUNT_MAX: 5000,
};

function validateCount(count) {
    if (!Number.isFinite(count) || count <= 0) {
        console.warn('Invalid particle count:', count);
        return SHAPE_CONFIG.PARTICLE_COUNT_MIN;
    }
    return Math.min(count, SHAPE_CONFIG.PARTICLE_COUNT_MAX);
}

/**
 * @namespace ShapeGenerators
 * @memberof module:ShapeGenerators
 */
export const ShapeGenerators = {
    heart(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = (i / count) * Math.PI * 2;
            const r = Math.random() * 0.3;
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            const z = (Math.random() - 0.5) * 5;
            positions[idx] = (x + (Math.random() - 0.5) * r * 16) * 0.15;
            positions[idx + 1] = (y + (Math.random() - 0.5) * r * 16) * 0.15;
            positions[idx + 2] = z * 0.3;
        }
        return positions;
    },

    flower(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const petals = 6;
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = (i / count) * Math.PI * 2;
            const petalR = 2 + Math.cos(petals * t) * 1.2;
            const r = petalR * (0.3 + Math.random() * 0.7);
            positions[idx] = r * Math.cos(t);
            positions[idx + 1] = r * Math.sin(t);
            positions[idx + 2] = (Math.random() - 0.5) * 1.5;
        }
        return positions;
    },

    saturn(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const bodyCount = Math.floor(count * 0.4);

        for (let i = 0; i < bodyCount; i++) {
            const idx = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 1.5 * Math.cbrt(Math.random());
            positions[idx] = r * Math.sin(phi) * Math.cos(theta);
            positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);
        }

        for (let i = bodyCount; i < count; i++) {
            const idx = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const ringR = 2.5 + Math.random() * 1.5;
            const thickness = (Math.random() - 0.5) * 0.2;
            positions[idx] = ringR * Math.cos(angle);
            positions[idx + 1] = thickness;
            positions[idx + 2] = ringR * Math.sin(angle);
        }
        return positions;
    },

    buddha(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = Math.random();
            let x, y, z;

            if (t < 0.3) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 0.8 * Math.cbrt(Math.random());
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta) + 3;
                z = r * Math.cos(phi);
            } else if (t < 0.7) {
                const theta = Math.random() * Math.PI * 2;
                const bodyY = Math.random() * 2.5;
                const bodyR = 1.2 + Math.sin(bodyY * 0.8) * 0.5;
                const r = bodyR * Math.sqrt(Math.random());
                x = r * Math.cos(theta);
                y = bodyY;
                z = r * Math.sin(theta) * 0.8;
            } else {
                const theta = Math.random() * Math.PI * 2;
                const baseR = 1.8 * Math.sqrt(Math.random());
                x = baseR * Math.cos(theta);
                y = -0.5 + Math.random() * 0.5;
                z = baseR * Math.sin(theta) * 0.6;
            }
            positions[idx] = x;
            positions[idx + 1] = y - 1.5;
            positions[idx + 2] = z;
        }
        return positions;
    },

    fireworks(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const burstCount = 5;
        const perBurst = Math.floor(count / burstCount);

        let idx = 0;
        for (let b = 0; b < burstCount; b++) {
            const cx = (Math.random() - 0.5) * 6;
            const cy = (Math.random() - 0.5) * 4 + 1;
            const cz = (Math.random() - 0.5) * 3;
            const burstR = 1 + Math.random() * 1.5;

            for (let i = 0; i < perBurst; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = burstR * Math.cbrt(Math.random());
                positions[idx] = cx + r * Math.sin(phi) * Math.cos(theta);
                positions[idx + 1] = cy + r * Math.sin(phi) * Math.sin(theta);
                positions[idx + 2] = cz + r * Math.cos(phi);
                idx += 3;
            }
        }

        while (idx < count * 3) {
            positions[idx] = (Math.random() - 0.5) * 8;
            positions[idx + 1] = Math.random() * 4;
            positions[idx + 2] = (Math.random() - 0.5) * 4;
            idx += 3;
        }
        return positions;
    },

    sphere(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 2.5 * Math.cbrt(Math.random());
            positions[idx] = r * Math.sin(phi) * Math.cos(theta);
            positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);
        }
        return positions;
    },

    star(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const points = 5;
        const outerRadius = 2.5;

        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = i / count;
            const angle = t * Math.PI * 2 * points;
            const r = outerRadius * (0.6 + Math.random() * 0.4);
            const spread = (Math.random() - 0.5) * 0.5;

            positions[idx] = r * Math.cos(angle) + spread;
            positions[idx + 1] = r * Math.sin(angle) + spread;
            positions[idx + 2] = (Math.random() - 0.5) * 0.8;
        }
        return positions;
    },

    spiral(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const turns = 4;

        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = i / count;
            const angle = t * Math.PI * 2 * turns;
            const radius = t * 3;
            const height = (t - 0.5) * 4;

            positions[idx] = radius * Math.cos(angle) + (Math.random() - 0.5) * 0.3;
            positions[idx + 1] = height + (Math.random() - 0.5) * 0.3;
            positions[idx + 2] = radius * Math.sin(angle) + (Math.random() - 0.5) * 0.3;
        }
        return positions;
    },

    dna(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const turns = 3;
        const radius = 1.5;

        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = i / count;
            const angle = t * Math.PI * 2 * turns;
            const height = (t - 0.5) * 6;
            const strandOffset = (i % 2) * Math.PI;

            positions[idx] = radius * Math.cos(angle + strandOffset);
            positions[idx + 1] = height;
            positions[idx + 2] = radius * Math.sin(angle + strandOffset);
        }
        return positions;
    },

    galaxy(count) {
        count = validateCount(count);
        const positions = new Float32Array(count * 3);
        const arms = 3;
        const armSpread = 0.4;

        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const t = i / count;
            const armIndex = Math.floor(i / (count / arms)) % arms;
            const baseAngle = (armIndex / arms) * Math.PI * 2;
            const distance = Math.pow(t, 0.6) * 4;
            const angle = baseAngle + distance * 0.4 + (Math.random() - 0.5) * armSpread;

            positions[idx] = distance * Math.cos(angle);
            positions[idx + 1] = (Math.random() - 0.5) * 0.2 * (1 - Math.pow(t, 0.5));
            positions[idx + 2] = distance * Math.sin(angle);
        }
        return positions;
    },
};