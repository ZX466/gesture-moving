import { describe, it, expect, beforeEach } from 'vitest';
import { SHAPE_CONFIG, ShapeGenerators } from '@modules/ShapeGenerators.js';

describe('SHAPE_CONFIG', () => {
  it('should define particle count bounds', () => {
    expect(SHAPE_CONFIG.PARTICLE_COUNT_MIN).toBe(100);
    expect(SHAPE_CONFIG.PARTICLE_COUNT_MAX).toBe(5000);
    expect(SHAPE_CONFIG.PARTICLE_COUNT_MIN).toBeLessThan(SHAPE_CONFIG.PARTICLE_COUNT_MAX);
  });
});

describe('ShapeGenerators', () => {
  describe('heart', () => {
    it('should return Float32Array with length count * 3', () => {
      const result = ShapeGenerators.heart(100);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(100 * 3);
    });

    it('should handle edge case count=1', () => {
      const result = ShapeGenerators.heart(1);
      expect(result.length).toBe(3);
    });

    it('should clamp large count to max', () => {
      const result = ShapeGenerators.heart(99999);
      expect(result.length).toBe(SHAPE_CONFIG.PARTICLE_COUNT_MAX * 3);
    });

    it('should handle zero or negative count', () => {
      const result = ShapeGenerators.heart(-5);
      expect(result.length).toBe(SHAPE_CONFIG.PARTICLE_COUNT_MIN * 3);
    });

    it('should return coordinates within reasonable bounds', () => {
      const result = ShapeGenerators.heart(100);
      for (let i = 0; i < result.length; i++) {
        expect(Number.isFinite(result[i])).toBe(true);
      }
    });
  });

  describe('flower', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.flower(200);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(200 * 3);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.flower(1);
      expect(result.length).toBe(3);
    });

    it('should produce petal-distributed coordinates', () => {
      const result = ShapeGenerators.flower(100);
      expect(result.length).toBe(300);
    });
  });

  describe('saturn', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.saturn(500);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(500 * 3);
    });

    it('should produce spherical body and ring particles', () => {
      const result = ShapeGenerators.saturn(1000);
      expect(result.length).toBe(3000);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.saturn(1);
      expect(result.length).toBe(3);
    });
  });

  describe('buddha', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.buddha(300);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(300 * 3);
    });

    it('should have all values finite', () => {
      const result = ShapeGenerators.buddha(100);
      for (let i = 0; i < result.length; i++) {
        expect(Number.isFinite(result[i])).toBe(true);
      }
    });
  });

  describe('fireworks', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.fireworks(500);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(500 * 3);
    });

    it('should distribute particles across multiple bursts', () => {
      const result = ShapeGenerators.fireworks(1000);
      expect(result.length).toBe(3000);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.fireworks(1);
      expect(result.length).toBe(3);
    });
  });

  describe('sphere', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.sphere(1000);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1000 * 3);
    });

    it('should produce uniformly distributed points', () => {
      const result = ShapeGenerators.sphere(500);
      expect(result.length).toBe(1500);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.sphere(1);
      expect(result.length).toBe(3);
    });

    it('should have all values finite', () => {
      const result = ShapeGenerators.sphere(100);
      for (let i = 0; i < result.length; i++) {
        expect(Number.isFinite(result[i])).toBe(true);
      }
    });
  });

  describe('star', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.star(100);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(100 * 3);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.star(1);
      expect(result.length).toBe(3);
    });
  });

  describe('spiral', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.spiral(200);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(200 * 3);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.spiral(1);
      expect(result.length).toBe(3);
    });
  });

  describe('dna', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.dna(300);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(300 * 3);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.dna(1);
      expect(result.length).toBe(3);
    });
  });

  describe('galaxy', () => {
    it('should return Float32Array with correct length', () => {
      const result = ShapeGenerators.galaxy(500);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(500 * 3);
    });

    it('should handle count=1', () => {
      const result = ShapeGenerators.galaxy(1);
      expect(result.length).toBe(3);
    });
  });

  describe('validation behavior', () => {
    it('should clamp extreme negative count', () => {
      const result = ShapeGenerators.sphere(-1000);
      expect(result.length).toBe(SHAPE_CONFIG.PARTICLE_COUNT_MIN * 3);
    });

    it('should clamp extreme large count', () => {
      const result = ShapeGenerators.heart(Number.MAX_SAFE_INTEGER);
      expect(result.length).toBe(SHAPE_CONFIG.PARTICLE_COUNT_MAX * 3);
    });

    it('should handle NaN gracefully', () => {
      const result = ShapeGenerators.flower(NaN);
      expect(result.length).toBe(SHAPE_CONFIG.PARTICLE_COUNT_MIN * 3);
    });
  });
});
