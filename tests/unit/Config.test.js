import { describe, it, expect } from 'vitest';
import { AppConfig } from '@modules/Config.js';

describe('AppConfig', () => {
  describe('particle config', () => {
    it('should have valid default particle settings', () => {
      expect(AppConfig.particle.defaultCount).toBe(1000);
      expect(AppConfig.particle.minCount).toBe(100);
      expect(AppConfig.particle.maxCount).toBe(5000);
      expect(AppConfig.particle.minCount).toBeLessThan(AppConfig.particle.maxCount);
    });

    it('should have valid default size settings', () => {
      expect(AppConfig.particle.defaultSize).toBe(2);
      expect(AppConfig.particle.minSize).toBe(0.5);
      expect(AppConfig.particle.maxSize).toBe(5);
      expect(AppConfig.particle.minSize).toBeLessThan(AppConfig.particle.maxSize);
    });

    it('should have a valid hex color', () => {
      const color = AppConfig.particle.defaultColor;
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('gesture config', () => {
    it('should have valid sensitivity range', () => {
      expect(AppConfig.gesture.minSensitivity).toBeLessThan(AppConfig.gesture.maxSensitivity);
      expect(AppConfig.gesture.defaultSensitivity).toBeGreaterThanOrEqual(AppConfig.gesture.minSensitivity);
      expect(AppConfig.gesture.defaultSensitivity).toBeLessThanOrEqual(AppConfig.gesture.maxSensitivity);
    });

    it('should have positive debounce frames', () => {
      expect(AppConfig.gesture.debounceFrames).toBeGreaterThan(0);
    });
  });

  describe('sword config', () => {
    it('should have positive orbit and fly speeds', () => {
      expect(AppConfig.sword.orbitSpeed).toBeGreaterThan(0);
      expect(AppConfig.sword.flySpeed).toBeGreaterThan(0);
    });

    it('should have positive bob amplitude', () => {
      expect(AppConfig.sword.bobAmplitude).toBeGreaterThan(0);
    });
  });

  describe('animation config', () => {
    it('should target 60 fps', () => {
      expect(AppConfig.animation.targetFps).toBe(60);
    });

    it('should have positive lerp speeds', () => {
      expect(AppConfig.animation.lerpSpeed).toBeGreaterThan(0);
      expect(AppConfig.animation.spreadLerpSpeed).toBeGreaterThan(0);
    });
  });

  describe('models', () => {
    it('should have at least 6 models', () => {
      expect(AppConfig.models.length).toBeGreaterThanOrEqual(6);
    });

    it('each model should have id, name, and icon', () => {
      AppConfig.models.forEach(model => {
        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.icon).toBe('string');
      });
    });

    it('model ids should be unique', () => {
      const ids = AppConfig.models.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('gestures', () => {
    it('should define the core gestures', () => {
      expect(AppConfig.gestures.sword_point).toBeDefined();
      expect(AppConfig.gestures.peace).toBeDefined();
      expect(AppConfig.gestures.fist).toBeDefined();
      expect(AppConfig.gestures.open_palm).toBeDefined();
    });

    it('each gesture should have name, description, and color', () => {
      Object.values(AppConfig.gestures).forEach(gesture => {
        expect(typeof gesture.name).toBe('string');
        expect(typeof gesture.description).toBe('string');
        expect(typeof gesture.color).toBe('string');
      });
    });
  });

  describe('validate()', () => {
    it('should return fallback for non-finite values', () => {
      expect(AppConfig.validate(NaN, 0, 10, 5)).toBe(5);
      expect(AppConfig.validate(Infinity, 0, 10, 5)).toBe(5);
      expect(AppConfig.validate('abc', 0, 10, 5)).toBe(5);
    });

    it('should clamp value within min/max range', () => {
      expect(AppConfig.validate(15, 0, 10, 5)).toBe(10);
      expect(AppConfig.validate(-5, 0, 10, 5)).toBe(0);
      expect(AppConfig.validate(7, 0, 10, 5)).toBe(7);
    });
  });

  describe('validateColor()', () => {
    it('should return default color for invalid input', () => {
      expect(AppConfig.validateColor(null)).toBe(AppConfig.particle.defaultColor);
      expect(AppConfig.validateColor(undefined)).toBe(AppConfig.particle.defaultColor);
      expect(AppConfig.validateColor(123)).toBe(AppConfig.particle.defaultColor);
    });

    it('should accept valid 6-digit hex color', () => {
      const result = AppConfig.validateColor('#ff5500');
      expect(result).toBe('#ff5500');
    });

    it('should reject invalid hex formats', () => {
      expect(AppConfig.validateColor('#fff')).toBe(AppConfig.particle.defaultColor);
      expect(AppConfig.validateColor('red')).toBe(AppConfig.particle.defaultColor);
    });
  });

  describe('validateModel()', () => {
    it('should return valid model id unchanged', () => {
      const result = AppConfig.validateModel('heart');
      expect(result).toBe('heart');
    });

    it('should return default model for invalid id', () => {
      const result = AppConfig.validateModel('invalid_model');
      expect(result).toBe('heart');
    });
  });

  describe('createParticleConfig()', () => {
    it('should create config with validated values', () => {
      const config = AppConfig.createParticleConfig({ count: 2000, size: 3 });
      expect(config.count).toBe(2000);
      expect(config.size).toBe(3);
    });

    it('should use defaults for omitted values', () => {
      const config = AppConfig.createParticleConfig({});
      expect(config.count).toBe(AppConfig.particle.defaultCount);
      expect(config.size).toBe(AppConfig.particle.defaultSize);
    });

    it('should clamp out-of-range values', () => {
      const config = AppConfig.createParticleConfig({ count: 99999, size: 100 });
      expect(config.count).toBe(AppConfig.particle.maxCount);
      expect(config.size).toBe(AppConfig.particle.maxSize);
    });
  });
});
