import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureRecognizer } from '@modules/GestureRecognizer.js';

/**
 * MediaPipe landmark index reference:
 * 0=wrist, 1=thumbCMC, 2=thumbMCP, 3=thumbIP, 4=thumbTip
 * 5=indexMCP, 6=indexPIP, 7=indexDIP, 8=indexTip
 * 9=middleMCP, 10=middlePIP, 11=middleDIP, 12=middleTip
 * 13=ringMCP, 14=ringPIP, 15=ringDIP, 16=ringTip
 * 17=pinkyMCP, 18=pinkyPIP, 19=pinkyDIP, 20=pinkyTip
 *
 * isFingerExtended: extended when dist(tip,wrist) > dist(pip,wrist) AND dist(pip,wrist) > dist(mcp,wrist)*0.9
 * OR when tip-to-pip / pip-to-mcp ratio > 0.8
 *
 * createMockLandmarks creates a hand where ALL fingers are CLOSED (curled).
 * Use overrides to open specific fingers.
 */

/**
 * @param {Object} overrides
 */
function createMockLandmarks(overrides = {}) {
  // Base: all fingers curled (default closed hand)
  const base = {
    0:  { x: 0.50, y: 0.50, z: 0 },    // wrist
    1:  { x: 0.48, y: 0.49, z: 0 },    // thumbCMC
    2:  { x: 0.47, y: 0.48, z: 0 },    // thumbMCP
    3:  { x: 0.47, y: 0.47, z: 0 },    // thumbIP
    4:  { x: 0.47, y: 0.48, z: 0 },    // thumbTip (curled)
    5:  { x: 0.44, y: 0.46, z: 0 },    // indexMCP
    6:  { x: 0.44, y: 0.43, z: 0 },    // indexPIP
    7:  { x: 0.44, y: 0.44, z: 0 },    // indexDIP
    8:  { x: 0.44, y: 0.45, z: 0 },    // indexTip (curled)
    9:  { x: 0.50, y: 0.46, z: 0 },    // middleMCP
    10: { x: 0.50, y: 0.43, z: 0 },    // middlePIP
    11: { x: 0.50, y: 0.44, z: 0 },    // middleDIP
    12: { x: 0.50, y: 0.45, z: 0 },    // middleTip (curled)
    13: { x: 0.56, y: 0.46, z: 0 },    // ringMCP
    14: { x: 0.56, y: 0.43, z: 0 },    // ringPIP
    15: { x: 0.56, y: 0.44, z: 0 },    // ringDIP
    16: { x: 0.56, y: 0.45, z: 0 },    // ringTip (curled)
    17: { x: 0.60, y: 0.47, z: 0 },    // pinkyMCP
    18: { x: 0.60, y: 0.44, z: 0 },    // pinkyPIP
    19: { x: 0.60, y: 0.45, z: 0 },    // pinkyDIP
    20: { x: 0.60, y: 0.46, z: 0 },    // pinkyTip (curled)
  };

  for (const [idx, props] of Object.entries(overrides)) {
    Object.assign(base[parseInt(idx)], props);
  }

  return Array.from({ length: 21 }, (_, i) => base[i]);
}

function createMockResults(landmarks) {
  return {
    multiHandLandmarks: [landmarks],
    multiHandedness: [{ score: 0.9, label: 'Right' }],
  };
}

describe('GestureRecognizer', () => {
  let recognizer;

  beforeEach(() => {
    recognizer = new GestureRecognizer();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(recognizer.config.swordPointAngleThreshold).toBe(0.5);
      expect(recognizer.config.peaceAngleThreshold).toBe(0.4);
      expect(recognizer.config.debounceFrames).toBe(3);
    });

    it('should accept custom config overrides', () => {
      const custom = new GestureRecognizer({ debounceFrames: 10 });
      expect(custom.config.debounceFrames).toBe(10);
    });

    it('should initialize with no camera active', () => {
      expect(recognizer.isCameraActive()).toBe(false);
    });

    it('should initialize with no gesture', () => {
      expect(recognizer.state.currentGesture).toBe('none');
    });
  });

  describe('getFingerStates()', () => {
    it('should return array of 5 booleans', () => {
      const lm = createMockLandmarks();
      const states = recognizer.getFingerStates(lm);
      expect(states).toHaveLength(5);
      expect(states.every(s => typeof s === 'boolean')).toBe(true);
    });

    it('should return all false for null input', () => {
      const states = recognizer.getFingerStates(null);
      expect(states).toEqual([false, false, false, false, false]);
    });

    it('should return all false for short array', () => {
      const states = recognizer.getFingerStates([{ x: 0, y: 0 }]);
      expect(states).toEqual([false, false, false, false, false]);
    });
  });

  describe('isThumbExtended()', () => {
    it('should return true when thumb is extended outward', () => {
      const lm = createMockLandmarks({
        4: { x: 0.7, y: 0.3, z: 0 },    // thumbTip extended outward-up
        3: { x: 0.5, y: 0.4, z: 0 },
        2: { x: 0.5, y: 0.45, z: 0 },
        0: { x: 0.5, y: 0.5, z: 0 },
      });
      expect(recognizer.isThumbExtended(lm)).toBe(true);
    });

    it('should return false when thumb is curled in', () => {
      const lm = createMockLandmarks({
        4: { x: 0.48, y: 0.47, z: 0 },
        3: { x: 0.47, y: 0.46, z: 0 },
        2: { x: 0.47, y: 0.47, z: 0 },
        0: { x: 0.5, y: 0.5, z: 0 },
      });
      expect(recognizer.isThumbExtended(lm)).toBe(false);
    });
  });

  describe('isFingerExtended()', () => {
    it('should return true when index finger is pointing up', () => {
      // Tip at top (low y), PIP mid, MCP at base (high y)
      const lm = createMockLandmarks({
        8: { x: 0.44, y: 0.10, z: 0 },   // indexTip extended up
        6: { x: 0.44, y: 0.30, z: 0 },   // indexPIP
        5: { x: 0.44, y: 0.46, z: 0 },   // indexMCP at base
        0: { x: 0.50, y: 0.50, z: 0 },
      });
      expect(recognizer.isFingerExtended(lm, 8, 6, 5)).toBe(true);
    });

    it('should return false when index finger is curled down', () => {
      // Tip at same level as PIP, both close to wrist
      const lm = createMockLandmarks({
        8: { x: 0.44, y: 0.45, z: 0 },   // indexTip curled (same level as wrist)
        6: { x: 0.44, y: 0.43, z: 0 },   // indexPIP
        5: { x: 0.44, y: 0.46, z: 0 },   // indexMCP
        0: { x: 0.50, y: 0.50, z: 0 },
      });
      expect(recognizer.isFingerExtended(lm, 8, 6, 5)).toBe(false);
    });
  });

  describe('dist2d()', () => {
    it('should calculate Euclidean distance in 2D', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 3, y: 4 };
      expect(recognizer.dist2d(a, b)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const p = { x: 0.5, y: 0.5 };
      expect(recognizer.dist2d(p, p)).toBe(0);
    });
  });

  describe('dist3d()', () => {
    it('should calculate Euclidean distance in 3D', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 1, y: 2, z: 2 };
      expect(recognizer.dist3d(a, b)).toBeCloseTo(3);
    });
  });

  describe('calculateFingerBend()', () => {
    it('should return bend ratios for all 5 fingers', () => {
      const lm = createMockLandmarks();
      const bend = recognizer.calculateFingerBend(lm);
      expect(bend).toHaveProperty('thumb');
      expect(bend).toHaveProperty('index');
      expect(bend).toHaveProperty('middle');
      expect(bend).toHaveProperty('ring');
      expect(bend).toHaveProperty('pinky');
    });

    it('should return finite ratios', () => {
      const lm = createMockLandmarks();
      const bend = recognizer.calculateFingerBend(lm);
      Object.values(bend).forEach(ratio => {
        expect(Number.isFinite(ratio)).toBe(true);
      });
    });
  });

  describe('calculateHandOpenness()', () => {
    it('should return value between 0 and 1', () => {
      const lm = createMockLandmarks();
      const openness = recognizer.calculateHandOpenness(lm);
      expect(openness).toBeGreaterThanOrEqual(0);
      expect(openness).toBeLessThanOrEqual(1);
    });
  });

  describe('classifyGesture() — unit-level behavior', () => {
    it('should detect sword_point: only index extended', () => {
      const lm = createMockLandmarks({
        // Index extended up
        8:  { x: 0.44, y: 0.10, z: 0 },
        6:  { x: 0.44, y: 0.30, z: 0 },
        5:  { x: 0.44, y: 0.46, z: 0 },
        0:  { x: 0.50, y: 0.50, z: 0 },
        // Middle curled
        12: { x: 0.50, y: 0.45, z: 0 },
        10: { x: 0.50, y: 0.43, z: 0 },
        // Ring curled
        16: { x: 0.56, y: 0.45, z: 0 },
        14: { x: 0.56, y: 0.43, z: 0 },
        // Pinky curled
        20: { x: 0.60, y: 0.46, z: 0 },
        18: { x: 0.60, y: 0.44, z: 0 },
      });
      const result = recognizer.classifyGesture(lm);
      expect(result).toBe('sword_point');
    });

    it('should detect peace: index + middle extended', () => {
      const lm = createMockLandmarks({
        // Index extended
        8:  { x: 0.44, y: 0.10, z: 0 },
        6:  { x: 0.44, y: 0.30, z: 0 },
        5:  { x: 0.44, y: 0.46, z: 0 },
        0:  { x: 0.50, y: 0.50, z: 0 },
        // Middle extended
        12: { x: 0.50, y: 0.10, z: 0 },
        10: { x: 0.50, y: 0.30, z: 0 },
        9:  { x: 0.50, y: 0.46, z: 0 },
        // Ring curled
        16: { x: 0.56, y: 0.45, z: 0 },
        14: { x: 0.56, y: 0.43, z: 0 },
        // Pinky curled
        20: { x: 0.60, y: 0.46, z: 0 },
        18: { x: 0.60, y: 0.44, z: 0 },
      });
      const result = recognizer.classifyGesture(lm);
      expect(result).toBe('peace');
    });

    it('should detect fist: no fingers extended', () => {
      // All fingers curled (default in createMockLandmarks)
      const lm = createMockLandmarks();
      const result = recognizer.classifyGesture(lm);
      expect(result).toBe('fist');
    });

    it('should detect unknown when no pattern matches', () => {
      // Middle extended but index curled — doesn't match any rule
      const lm = createMockLandmarks({
        8:  { x: 0.44, y: 0.45, z: 0 },
        6:  { x: 0.44, y: 0.43, z: 0 },
        12: { x: 0.50, y: 0.10, z: 0 },
        10: { x: 0.50, y: 0.30, z: 0 },
        16: { x: 0.56, y: 0.45, z: 0 },
        14: { x: 0.56, y: 0.43, z: 0 },
        20: { x: 0.60, y: 0.46, z: 0 },
        18: { x: 0.60, y: 0.44, z: 0 },
      });
      const result = recognizer.classifyGesture(lm);
      expect(result).toBe('unknown');
    });

    it('should detect open_palm with 3 of 4 non-thumb fingers extended (relaxed)', () => {
      const lm = createMockLandmarks({
        8:  { x: 0.44, y: 0.10, z: 0 },
        6:  { x: 0.44, y: 0.30, z: 0 },
        5:  { x: 0.44, y: 0.46, z: 0 },
        0:  { x: 0.50, y: 0.50, z: 0 },
        12: { x: 0.50, y: 0.10, z: 0 },
        10: { x: 0.50, y: 0.30, z: 0 },
        9:  { x: 0.50, y: 0.46, z: 0 },
        16: { x: 0.56, y: 0.10, z: 0 },
        14: { x: 0.56, y: 0.30, z: 0 },
        13: { x: 0.56, y: 0.46, z: 0 },
        20: { x: 0.60, y: 0.46, z: 0 },
        18: { x: 0.60, y: 0.44, z: 0 },
      });
      const result = recognizer.classifyGesture(lm);
      expect(result).toBe('open_palm');
    });
  });

  describe('validateLandmarks()', () => {
    it('should accept valid landmark array', () => {
      const lm = createMockLandmarks();
      const results = createMockResults(lm);
      expect(recognizer.validateLandmarks(lm, results)).toBe(true);
    });

    it('should reject null landmarks', () => {
      expect(recognizer.validateLandmarks(null, {})).toBe(false);
    });

    it('should reject landmarks with less than 21 points', () => {
      const shortLm = createMockLandmarks().slice(0, 10);
      expect(recognizer.validateLandmarks(shortLm, {})).toBe(false);
    });

    it('should reject landmarks with non-finite x', () => {
      const badLm = createMockLandmarks({ 8: { x: NaN, y: 0.5, z: 0 } });
      expect(recognizer.validateLandmarks(badLm, {})).toBe(false);
    });

    it('should reject landmarks with non-finite y', () => {
      const badLm = createMockLandmarks({ 8: { x: 0.5, y: Infinity, z: 0 } });
      expect(recognizer.validateLandmarks(badLm, {})).toBe(false);
    });
  });

  describe('event system', () => {
    it('should allow registering a gesture change listener', () => {
      const callback = vi.fn();
      recognizer.on('gestureChange', callback);
      expect(recognizer.listeners.gestureChange).toContain(callback);
    });

    it('should allow unregistering a listener', () => {
      const callback = vi.fn();
      recognizer.on('gestureChange', callback);
      recognizer.off('gestureChange', callback);
      expect(recognizer.listeners.gestureChange).not.toContain(callback);
    });

    it('should notify all registered listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      recognizer.on('gestureChange', cb1);
      recognizer.on('gestureChange', cb2);
      recognizer.notify('gestureChange', { gesture: 'peace' });
      expect(cb1).toHaveBeenCalledWith({ gesture: 'peace' });
      expect(cb2).toHaveBeenCalledWith({ gesture: 'peace' });
    });
  });

  describe('getState()', () => {
    it('should return a copy of current state', () => {
      const state = recognizer.getState();
      expect(state).toHaveProperty('currentGesture', 'none');
      expect(state).toHaveProperty('handPos');
    });

    it('should return a new object each call (not same reference)', () => {
      const state1 = recognizer.getState();
      const state2 = recognizer.getState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('updateSensitivity()', () => {
    it('should decrease debounceFrames when sensitivity increases', () => {
      recognizer.updateSensitivity(2.0);
      expect(recognizer.config.debounceFrames).toBe(2);
    });

    it('should increase debounceFrames when sensitivity decreases', () => {
      recognizer.updateSensitivity(0.5);
      expect(recognizer.config.debounceFrames).toBe(6);
    });

    it('should increase palmVelocityThreshold when sensitivity increases', () => {
      recognizer.updateSensitivity(2.0);
      expect(recognizer.config.palmVelocityThreshold).toBe(6.0);
    });
  });
});
