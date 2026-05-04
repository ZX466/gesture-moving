/**
 * @fileoverview UI event bindings and DOM management.
 * Binds all control panel interactions to configured callbacks.
 */

import type { UIManagerConfig, UIElements } from '../types.js';

function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}

function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  let lastCall = 0;
  return (...args: Args) => {
    const now = performance.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

export class UIManager {
  private readonly config: Required<UIManagerConfig>;
  private readonly elements: UIElements = {
    colorPicker: null,
    colorValue: null,
    modelBtns: document.querySelectorAll('.model-btn'),
    countSlider: null,
    countValue: null,
    sizeSlider: null,
    sizeValue: null,
    sensitivitySlider: null,
    sensitivityValue: null,
    startBtn: null,
    stopBtn: null,
    swordToggle: null,
    swordToggleLabel: null,
    resetBtn: null,
    screenshotBtn: null,
    fullscreenBtn: null,
    cameraStatus: null,
    gestureStatus: null,
  };

  private swordEnabled = true;
  private readonly debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  constructor(config: UIManagerConfig = {}) {
    this.config = {
      onColorChange: config.onColorChange ?? (() => {}),
      onModelChange: config.onModelChange ?? (() => {}),
      onCountChange: config.onCountChange ?? (() => {}),
      onSizeChange: config.onSizeChange ?? (() => {}),
      onSensitivityChange: config.onSensitivityChange ?? (() => {}),
      onCameraStart: config.onCameraStart ?? (() => {}),
      onCameraStop: config.onCameraStop ?? (() => {}),
      onSwordToggle: config.onSwordToggle ?? (() => {}),
      onReset: config.onReset ?? (() => {}),
      onScreenshot: config.onScreenshot ?? (() => {}),
      onFullscreen: config.onFullscreen ?? (() => {}),
      onError: config.onError ?? ((err) => console.error('[UIManager]', err)),
    };

    this.cacheElements();
    this.bindEvents();
  }

  private cacheElements(): void {
    this.elements.colorPicker = document.getElementById('color-picker') as HTMLInputElement | null;
    this.elements.colorValue = document.getElementById('color-value') ?? null;
    this.elements.countSlider = document.getElementById('particle-count') as HTMLInputElement | null;
    this.elements.countValue = document.getElementById('particle-count-value') ?? null;
    this.elements.sizeSlider = document.getElementById('particle-size') as HTMLInputElement | null;
    this.elements.sizeValue = document.getElementById('particle-size-value') ?? null;
    this.elements.sensitivitySlider = document.getElementById('gesture-sensitivity') as HTMLInputElement | null;
    this.elements.sensitivityValue = document.getElementById('gesture-sensitivity-value') ?? null;
    this.elements.startBtn = document.getElementById('start-camera') as HTMLButtonElement | null;
    this.elements.stopBtn = document.getElementById('stop-camera') as HTMLButtonElement | null;
    this.elements.swordToggle = document.getElementById('sword-toggle') as HTMLButtonElement | null;
    this.elements.swordToggleLabel = document.getElementById('sword-toggle-label') ?? null;
    this.elements.resetBtn = document.getElementById('reset-btn') as HTMLButtonElement | null;
    this.elements.screenshotBtn = document.getElementById('screenshot-btn') as HTMLButtonElement | null;
    this.elements.fullscreenBtn = document.getElementById('fullscreen-btn') as HTMLButtonElement | null;
    this.elements.cameraStatus = document.getElementById('camera-status') ?? null;
    this.elements.gestureStatus = document.getElementById('gesture-status') ?? null;
  }

  private bindEvents(): void {
    this.bindModelButtons();
    this.bindColorPicker();
    this.bindCountSlider();
    this.bindSizeSlider();
    this.bindSensitivitySlider();
    this.bindCameraControls();
    this.bindSwordToggle();
    this.bindResetButton();
    this.bindScreenshot();
    this.bindFullscreen();
  }

  private bindModelButtons(): void {
    this.elements.modelBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.elements.modelBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const model = (btn as HTMLElement).dataset.model;
        if (model) this.config.onModelChange(model);
      });
    });
  }

  private bindColorPicker(): void {
    const picker = this.elements.colorPicker;
    if (!picker) return;

    const handleColorChange = debounce((color: string) => {
      this.config.onColorChange(color);
      if (this.elements.colorValue) {
        this.elements.colorValue.textContent = color;
      }
    }, 100);

    picker.addEventListener('input', (e) => {
      handleColorChange((e.target as HTMLInputElement).value);
    });
  }

  private bindCountSlider(): void {
    const slider = this.elements.countSlider;
    if (!slider) return;

    const handleCountChange = debounce((count: number) => {
      this.config.onCountChange(count);
    }, 200);

    slider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      if (this.elements.countValue) {
        this.elements.countValue.textContent = String(value);
      }
      handleCountChange(value);
    });
  }

  private bindSizeSlider(): void {
    const slider = this.elements.sizeSlider;
    if (!slider) return;

    const handleSizeChange = debounce((size: number) => {
      this.config.onSizeChange(size);
    }, 200);

    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (this.elements.sizeValue) {
        this.elements.sizeValue.textContent = value.toFixed(1);
      }
      handleSizeChange(value);
    });
  }

  private bindSensitivitySlider(): void {
    const slider = this.elements.sensitivitySlider;
    if (!slider) return;

    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (this.elements.sensitivityValue) {
        this.elements.sensitivityValue.textContent = value.toFixed(1);
      }
      this.config.onSensitivityChange(value);
    });
  }

  private bindCameraControls(): void {
    this.elements.startBtn?.addEventListener('click', () => {
      this.config.onCameraStart();
      this.setCameraStatus('starting', '正在启动摄像头...');
    });

    this.elements.stopBtn?.addEventListener('click', () => {
      this.config.onCameraStop();
      this.setCameraStatus('inactive', '摄像头已停止');
    });
  }

  private bindSwordToggle(): void {
    const toggle = this.elements.swordToggle;
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      this.swordEnabled = !this.swordEnabled;
      toggle.classList.toggle('active', this.swordEnabled);
      if (this.elements.swordToggleLabel) {
        this.elements.swordToggleLabel.textContent = this.swordEnabled
          ? '飞剑已开启'
          : '飞剑已关闭';
      }
      this.config.onSwordToggle(this.swordEnabled);
    });
  }

  private bindResetButton(): void {
    this.elements.resetBtn?.addEventListener('click', () => {
      this.config.onReset();
    });
  }

  private bindScreenshot(): void {
    this.elements.screenshotBtn?.addEventListener('click', () => {
      this.config.onScreenshot();
    });
  }

  private bindFullscreen(): void {
    this.elements.fullscreenBtn?.addEventListener('click', () => {
      this.config.onFullscreen();
    });
  }

  setCameraStatus(
    status: 'active' | 'starting' | 'inactive',
    message: string,
  ): void {
    if (this.elements.cameraStatus) {
      this.elements.cameraStatus.textContent = message;
      this.elements.cameraStatus.className = `camera-status ${status}`;
    }
  }

  updateGestureHint(gesture: string): void {
    if (this.elements.gestureStatus) {
      this.elements.gestureStatus.textContent = gesture !== 'none' ? gesture : '';
    }
  }

  showError(message: string): void {
    this.config.onError(new Error(message));
  }

  isSwordEnabled(): boolean {
    return this.swordEnabled;
  }

  setActiveModel(modelId: string): void {
    this.elements.modelBtns.forEach((btn) => {
      (btn as HTMLElement).classList.remove('active');
      if ((btn as HTMLElement).dataset.model === modelId) {
        (btn as HTMLElement).classList.add('active');
      }
    });
  }

  dispose(): void {
    Object.values(this.debounceTimers).forEach(clearTimeout);
  }
}

export default UIManager;
