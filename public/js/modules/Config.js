/**
 * @typedef {Object} ParticleConfig
 * @property {number} defaultCount
 * @property {number} minCount
 * @property {number} maxCount
 * @property {number} defaultSize
 * @property {number} minSize
 * @property {number} maxSize
 * @property {string} defaultColor
 */

/**
 * @typedef {Object} GestureConfig
 * @property {number} defaultSensitivity
 * @property {number} minSensitivity
 * @property {number} maxSensitivity
 * @property {number} debounceFrames
 * @property {number} minGestureDuration
 * @property {number} palmVelocityThreshold
 * @property {number} swordPointAngleThreshold
 * @property {number} peaceAngleThreshold
 * @property {number} thumbDistRatio
 * @property {number} fingerBendThreshold
 */

/**
 * @typedef {Object} CameraConfig
 * @property {number} width
 * @property {number} height
 * @property {string} facingMode
 * @property {number} minDetectionConfidence
 * @property {number} minTrackingConfidence
 * @property {number} maxNumHands
 * @property {number} modelComplexity
 */

/**
 * @typedef {Object} SceneConfig
 * @property {number} fov
 * @property {number} cameraZ
 * @property {number} backgroundColor
 * @property {number} maxPixelRatio
 */

/**
 * @typedef {Object} SwordConfig
 * @property {number} trailLength
 * @property {number} orbitRadius
 * @property {number} orbitSpeed
 * @property {number} flySpeed
 * @property {number} bobSpeed
 * @property {number} bobAmplitude
 * @property {number} maxVelocity
 */

/**
 * @typedef {Object} AnimationConfig
 * @property {number} lerpSpeed
 * @property {number} spreadLerpSpeed
 * @property {number} rotationSpeed
 * @property {number} targetFps
 * @property {number} maxDelta
 */

/**
 * @typedef {Object} PerformanceConfig
 * @property {number} warningThreshold
 * @property {number} criticalThreshold
 * @property {number} sampleSize
 */

/**
 * @typedef {Object} ErrorConfig
 * @property {number} maxErrors
 * @property {boolean} showUserErrors
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 */

/**
 * @typedef {Object} GestureInfo
 * @property {string} name
 * @property {string} description
 * @property {string} color
 */

/**
 * @typedef {Object} AppConfigObject
 * @property {ParticleConfig} particle
 * @property {GestureConfig} gesture
 * @property {CameraConfig} camera
 * @property {SceneConfig} scene
 * @property {SwordConfig} sword
 * @property {AnimationConfig} animation
 * @property {PerformanceConfig} performance
 * @property {ErrorConfig} error
 * @property {ModelInfo[]} models
 * @property {Record<string, GestureInfo>} gestures
 */

/** @type {AppConfigObject} */
export const AppConfig = {
    particle: {
        defaultCount: 1000,
        minCount: 100,
        maxCount: 5000,
        defaultSize: 2,
        minSize: 0.5,
        maxSize: 5,
        defaultColor: '#4f46e5'
    },

    gesture: {
        defaultSensitivity: 1.0,
        minSensitivity: 0.5,
        maxSensitivity: 2.0,
        debounceFrames: 3,
        minGestureDuration: 150,
        palmVelocityThreshold: 3.0,
        swordPointAngleThreshold: 0.5,
        peaceAngleThreshold: 0.4,
        thumbDistRatio: 1.1,
        fingerBendThreshold: 0.04
    },

    camera: {
        width: 640,
        height: 480,
        facingMode: 'user',
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        maxNumHands: 1,
        modelComplexity: 1
    },

    scene: {
        fov: 60,
        cameraZ: 10,
        backgroundColor: 0x0a0e27,
        maxPixelRatio: 2
    },

    sword: {
        trailLength: 50,
        orbitRadius: 4,
        orbitSpeed: 0.8,
        flySpeed: 0.12,
        bobSpeed: 2.0,
        bobAmplitude: 0.15,
        maxVelocity: 0.5
    },

    animation: {
        lerpSpeed: 4,
        spreadLerpSpeed: 8,
        rotationSpeed: 0.15,
        targetFps: 60,
        maxDelta: 0.05
    },

    performance: {
        warningThreshold: 30,
        criticalThreshold: 15,
        sampleSize: 60
    },

    error: {
        maxErrors: 50,
        showUserErrors: true
    },

    models: [
        { id: 'heart', name: '爱心', icon: 'fa-heart' },
        { id: 'flower', name: '花朵', icon: 'fa-fan' },
        { id: 'saturn', name: '土星', icon: 'fa-circle-notch' },
        { id: 'buddha', name: '佛像', icon: 'fa-om' },
        { id: 'fireworks', name: '烟花', icon: 'fa-burst' },
        { id: 'sphere', name: '球体', icon: 'fa-circle' },
        { id: 'star', name: '星星', icon: 'fa-star' },
        { id: 'spiral', name: '螺旋', icon: 'fa-rotate' },
        { id: 'dna', name: 'DNA', icon: 'fa-dna' },
        { id: 'galaxy', name: '星系', icon: 'fa-galaxy' }
    ],

    gestures: {
        sword_point: { name: '剑指', description: '召唤飞剑到指尖', color: '#60d0ff' },
        peace: { name: '双指', description: '御剑飞行', color: '#60d0ff' },
        fist: { name: '握拳', description: '自动巡航', color: '#60d0ff' },
        open_palm: { name: '张开', description: '粒子散射', color: '#60d0ff' },
        thumb_up: { name: '拇指', description: '加速旋转', color: '#60d0ff' },
        move_palm: { name: '移动手掌', description: '粒子跟随', color: '#a78bfa' },
        rotate_wrist: { name: '旋转手腕', description: '场景旋转', color: '#a78bfa' }
    },

    validate(value, min, max, fallback) {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(min, Math.min(max, value));
    },

    validateColor(color) {
        if (typeof color !== 'string') return this.particle.defaultColor;
        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        if (hexPattern.test(color)) return color;
        return this.particle.defaultColor;
    },

    validateModel(modelId) {
        return this.models.some(m => m.id === modelId) ? modelId : 'heart';
    },

    createParticleConfig(overrides = {}) {
        return {
            count: this.validate(overrides.count, this.particle.minCount, this.particle.maxCount, this.particle.defaultCount),
            size: this.validate(overrides.size, this.particle.minSize, this.particle.maxSize, this.particle.defaultSize),
            color: this.validateColor(overrides.color),
            sensitivity: this.validate(overrides.sensitivity, this.gesture.minSensitivity, this.gesture.maxSensitivity, this.gesture.defaultSensitivity)
        };
    },

    createGestureConfig(overrides = {}) {
        return {
            ...this.gesture,
            ...overrides
        };
    },

    createCameraConfig(overrides = {}) {
        return {
            ...this.camera,
            ...overrides
        };
    }
};

export default AppConfig;
