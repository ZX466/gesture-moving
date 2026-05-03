export class UIManager {
    constructor(config = {}) {
        this.config = {
            onColorChange: config.onColorChange || (() => {}),
            onModelChange: config.onModelChange || (() => {}),
            onCountChange: config.onCountChange || (() => {}),
            onSizeChange: config.onSizeChange || (() => {}),
            onSensitivityChange: config.onSensitivityChange || (() => {}),
            onCameraStart: config.onCameraStart || (() => {}),
            onCameraStop: config.onCameraStop || (() => {}),
            onSwordToggle: config.onSwordToggle || (() => {}),
            onReset: config.onReset || (() => {}),
            onScreenshot: config.onScreenshot || (() => {}),
            onFullscreen: config.onFullscreen || (() => {}),
            onError: config.onError || ((err) => console.error('[UIManager]', err)),
            ...config
        };

        this.elements = {};
        this.swordEnabled = true;
        this.debounceTimers = {};
        this.throttleTimers = {};
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        this.elements = {
            colorPicker: document.getElementById('color-picker'),
            colorValue: document.getElementById('color-value'),
            modelBtns: document.querySelectorAll('.model-btn'),
            countSlider: document.getElementById('particle-count'),
            countValue: document.getElementById('particle-count-value'),
            sizeSlider: document.getElementById('particle-size'),
            sizeValue: document.getElementById('particle-size-value'),
            sensitivitySlider: document.getElementById('gesture-sensitivity'),
            sensitivityValue: document.getElementById('gesture-sensitivity-value'),
            startBtn: document.getElementById('start-camera'),
            stopBtn: document.getElementById('stop-camera'),
            swordToggle: document.getElementById('sword-toggle'),
            swordToggleLabel: document.getElementById('sword-toggle-label'),
            resetBtn: document.getElementById('reset-btn'),
            screenshotBtn: document.getElementById('screenshot-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            cameraStatus: document.getElementById('camera-status'),
            gestureStatus: document.getElementById('gesture-status')
        };
    }

    bindEvents() {
        this.bindModelButtons();
        this.bindColorPicker();
        this.bindCountSlider();
        this.bindSizeSlider();
        this.bindSensitivitySlider();
        this.bindCameraControls();
        this.bindSwordToggle();
        this.bindResetButton();
        this.bindScreenshotButton();
        this.bindFullscreenButton();
        this.bindKeyboardShortcuts();
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' && e.ctrlKey) {
                e.preventDefault();
                this.config.onFullscreen();
            }
            if (e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                this.config.onScreenshot();
            }
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.config.onReset();
            }
        });
    }

    bindModelButtons() {
        const { modelBtns } = this.elements;
        modelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.config.onModelChange(btn.dataset.model);
            });
        });
    }

    bindColorPicker() {
        const { colorPicker, colorValue } = this.elements;
        if (!colorPicker) return;

        const debouncedChange = this.debounce('color', (color) => {
            this.config.onColorChange(color);
        }, 100);

        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            if (colorValue) colorValue.textContent = color;
            debouncedChange(color);
        });
    }

    bindCountSlider() {
        const { countSlider, countValue } = this.elements;
        if (!countSlider) return;

        const updateCount = this.debounce('count', (val) => {
            this.config.onCountChange(val);
        }, 200);

        countSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (isNaN(val)) return;
            if (countValue) countValue.textContent = val;
            updateCount(val);
        });
    }

    bindSizeSlider() {
        const { sizeSlider, sizeValue } = this.elements;
        if (!sizeSlider) return;

        const updateSize = this.debounce('size', (val) => {
            this.config.onSizeChange(val);
        }, 100);

        sizeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            if (sizeValue) sizeValue.textContent = val.toFixed(1);
            updateSize(val);
        });
    }

    bindSensitivitySlider() {
        const { sensitivitySlider, sensitivityValue } = this.elements;
        if (!sensitivitySlider) return;

        const updateSensitivity = this.debounce('sensitivity', (val) => {
            this.config.onSensitivityChange(val);
        }, 100);

        sensitivitySlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            if (sensitivityValue) sensitivityValue.textContent = val.toFixed(1);
            updateSensitivity(val);
        });
    }

    bindCameraControls() {
        const { startBtn, stopBtn } = this.elements;

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (startBtn.dataset.active === 'true') return;
                startBtn.dataset.active = 'true';
                this.config.onCameraStart();
                this.setCameraButtonsState('active');
                this.updateCameraStatus('loading', '正在初始化...');
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.config.onCameraStop();
                this.setCameraButtonsState('inactive');
                const startBtnEl = this.elements.startBtn;
                if (startBtnEl) startBtnEl.dataset.active = 'false';
            });
        }
    }

    bindSwordToggle() {
        const { swordToggle, swordToggleLabel } = this.elements;
        if (!swordToggle) return;

        swordToggle.addEventListener('click', () => {
            this.swordEnabled = !this.swordEnabled;
            swordToggle.classList.toggle('active', this.swordEnabled);
            if (swordToggleLabel) {
                swordToggleLabel.textContent = this.swordEnabled ? '飞剑已开启' : '飞剑已关闭';
            }
            this.config.onSwordToggle(this.swordEnabled);
        });
    }

    bindResetButton() {
        const { resetBtn, colorPicker, colorValue, modelBtns } = this.elements;
        if (!resetBtn) return;

        resetBtn.addEventListener('click', () => {
            this.config.onReset();

            if (colorPicker) colorPicker.value = '#4f46e5';
            if (colorValue) colorValue.textContent = '#4f46e5';

            modelBtns.forEach(b => b.classList.remove('active'));
            const heartBtn = document.querySelector('[data-model="heart"]');
            if (heartBtn) heartBtn.classList.add('active');
        });
    }

    bindScreenshotButton() {
        const { screenshotBtn } = this.elements;
        if (!screenshotBtn) return;

        screenshotBtn.addEventListener('click', () => {
            this.config.onScreenshot();
        });
    }

    bindFullscreenButton() {
        const { fullscreenBtn } = this.elements;
        if (!fullscreenBtn) return;

        fullscreenBtn.addEventListener('click', () => {
            this.config.onFullscreen();
        });

        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenButton();
        });
    }

    setCameraButtonsState(state) {
        const { startBtn, stopBtn } = this.elements;
        if (state === 'active') {
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'flex';
        } else {
            if (startBtn) startBtn.style.display = 'flex';
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    updateCameraStatus(status, message) {
        const { cameraStatus } = this.elements;
        if (!cameraStatus) return;

        const icons = {
            active: '<i class="fas fa-circle" style="font-size: 8px; color: #10b981;"></i>',
            inactive: '<i class="fas fa-circle" style="font-size: 8px; color: #ef4444;"></i>',
            loading: '<i class="fas fa-circle-notch loading" style="font-size: 8px; color: #fbbf24;"></i>'
        };

        cameraStatus.innerHTML = icons[status] + ' ' + message;
    }

    updateGestureHint(gesture) {
        const { gestureStatus } = this.elements;
        if (!gestureStatus) return;

        const GESTURE_LABELS = {
            sword_point: '🗡️ 剑指 — 召唤飞剑',
            peace: '✌️ 双指 — 御剑飞行',
            fist: '✊ 握拳 — 自动巡航',
            open_palm: '🖐️ 张开 — 粒子散射',
            thumb_up: '👍 竖拇指 — 加速旋转',
            none: '',
            unknown: '🤔 识别中...',
        };

        gestureStatus.textContent = GESTURE_LABELS[gesture] || '';
        gestureStatus.style.opacity = gesture !== 'none' ? '1' : '0.3';
    }

    updateFullscreenButton() {
        const { fullscreenBtn } = this.elements;
        if (!fullscreenBtn) return;

        fullscreenBtn.innerHTML = document.fullscreenElement
            ? '<i class="fas fa-compress"></i>'
            : '<i class="fas fa-expand"></i>';
    }

    setActiveModel(model) {
        const { modelBtns } = this.elements;
        modelBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.model === model);
        });
    }

    debounce(key, fn, wait) {
        return (...args) => {
            if (this.debounceTimers[key]) {
                clearTimeout(this.debounceTimers[key]);
            }
            this.debounceTimers[key] = setTimeout(() => {
                fn.apply(this, args);
                delete this.debounceTimers[key];
            }, wait);
        };
    }

    throttle(key, fn, limit) {
        return (...args) => {
            if (!this.throttleTimers[key]) {
                this.throttleTimers[key] = setTimeout(() => {
                    fn.apply(this, args);
                    delete this.throttleTimers[key];
                }, limit);
            }
        };
    }

    showError(message, duration = 3000) {
        const existing = document.querySelector('.ui-error-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'ui-error-toast';
        toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    showSuccess(message, duration = 2000) {
        const existing = document.querySelector('.ui-success-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'ui-success-toast';
        toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(16, 185, 129, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    getSwordEnabled() {
        return this.swordEnabled;
    }

    dispose() {
        Object.keys(this.debounceTimers).forEach(key => {
            clearTimeout(this.debounceTimers[key]);
        });
        Object.keys(this.throttleTimers).forEach(key => {
            clearTimeout(this.throttleTimers[key]);
        });
        Object.keys(this.elements).forEach(key => {
            this.elements[key] = null;
        });
    }
}