// ============================================================
// Shared Types for Particle Art System
// ============================================================

// MediaPipe Hands types (runtime loaded from CDN)
declare global {
  interface HandResults {
    multiHandLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    multiHandedness?: Array<{ score: number }>;
  }
  type Landmark2D = { x: number; y: number; z?: number };
}

export interface ParticleConfig {
  defaultCount: number;
  minCount: number;
  maxCount: number;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  defaultColor: string;
}

export interface ParticleConfigInput {
  count?: number;
  size?: number;
  color?: string;
  sensitivity?: number;
}

export interface ParticleRuntimeConfig extends ParticleConfig {
  count: number;
  size: number;
  color: string;
  sensitivity: number;
}

export interface GestureConfig {
  defaultSensitivity: number;
  minSensitivity: number;
  maxSensitivity: number;
  debounceFrames: number;
  minGestureDuration: number;
  palmVelocityThreshold: number;
  swordPointAngleThreshold: number;
  peaceAngleThreshold: number;
  thumbDistRatio: number;
  fingerBendThreshold: number;
  hysteresisFrames: number;
  recoveryDelay: number;
}

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: string;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  maxNumHands: number;
  modelComplexity: number;
}

export interface SceneConfig {
  fov: number;
  cameraZ: number;
  backgroundColor: number;
  maxPixelRatio: number;
  containerId: string;
}

export interface SwordConfig {
  trailLength?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  flySpeed?: number;
  bobSpeed?: number;
  bobAmplitude?: number;
  maxVelocity?: number;
}

export interface AnimationConfig {
  lerpSpeed: number;
  spreadLerpSpeed: number;
  rotationSpeed: number;
  targetFps: number;
  maxDelta: number;
}

export interface PerformanceConfig {
  warningThreshold: number;
  criticalThreshold: number;
  sampleSize: number;
}

export interface ErrorConfig {
  maxErrors: number;
  showUserErrors: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  icon: string;
}

export interface GestureInfo {
  name: string;
  description: string;
  color: string;
}

export interface AppConfigShape {
  particle: ParticleConfig;
  gesture: GestureConfig;
  camera: CameraConfig;
  scene: SceneConfig;
  sword: SwordConfig;
  animation: AnimationConfig;
  performance: PerformanceConfig;
  error: ErrorConfig;
  models: ModelInfo[];
  gestures: Record<string, GestureInfo>;
  validate(value: number, min: number, max: number, fallback: number): number;
  validateColor(color: unknown): string;
  validateModel(modelId: unknown): string;
  createParticleConfig(overrides?: ParticleConfigInput): ParticleRuntimeConfig;
  createGestureConfig(overrides?: Partial<GestureConfig>): GestureConfig;
  createCameraConfig(overrides?: Partial<CameraConfig>): CameraConfig;
}

export interface Landmark2D {
  x: number;
  y: number;
  z?: number;
}

export interface HandResults {
  multiHandLandmarks?: Landmark2D[][];
  multiHandedness?: Array<{ score: number; label: string }>;
}

export interface GestureRecognizerConfig {
  swordPointAngleThreshold?: number;
  peaceAngleThreshold?: number;
  thumbDistRatio?: number;
  fingerBendThreshold?: number;
  palmVelocityThreshold?: number;
  debounceFrames?: number;
  hysteresisFrames?: number;
  minGestureDuration?: number;
  recoveryDelay?: number;
}

export type GestureType =
  | 'sword_point'
  | 'peace'
  | 'fist'
  | 'open_palm'
  | 'thumb_up'
  | 'none'
  | 'unknown';

export interface HandPosition {
  x: number;
  y: number;
}

export interface FingerBend {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export type SwordState = 'idle' | 'summoned' | 'flying';

export interface ShapeConfig {
  PARTICLE_COUNT_MIN: number;
  PARTICLE_COUNT_MAX: number;
}

// --- PerformanceMonitor types ---
export interface PerformanceMetrics {
  fps: number[];
  frameTime: number[];
  memoryUsage: Array<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    timestamp: number;
  }>;
  particleCount: number;
  drawCalls: number;
  triangles: number;
}

export type PerformanceLevel = 'warning' | 'critical';

export interface PerformanceAlert {
  level: PerformanceLevel;
  message: string;
  fps: number;
  suggestions: string[];
}

export type PerformanceListener = (alert: PerformanceAlert) => void;

export interface PerformanceStats {
  fps: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  frameTime: {
    average: number;
    min: number;
    max: number;
  };
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    timestamp: number;
  } | null;
  renderer: {
    drawCalls: number;
    triangles: number;
  };
}

export interface PerformanceMonitorConfig {
  sampleSize?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

// --- ErrorManager types ---
export interface ErrorEntry {
  timestamp: number;
  message: string;
  stack: string;
  context: Record<string, unknown>;
  url: string;
  userAgent: string;
}

export interface UserErrorEntry {
  type: 'user_error';
  message: string;
  originalError: ErrorEntry;
}

export type ErrorListener = (entry: ErrorEntry | UserErrorEntry) => void;

// --- SceneManager types ---
export interface SceneManagerConfig {
  fov?: number;
  cameraZ?: number;
  backgroundColor?: number;
  maxPixelRatio?: number;
}

// --- UIManager types ---
export interface UIManagerConfig {
  onColorChange?: (color: string) => void;
  onModelChange?: (model: string) => void;
  onCountChange?: (count: number) => void;
  onSizeChange?: (size: number) => void;
  onSensitivityChange?: (sensitivity: number) => void;
  onCameraStart?: () => void;
  onCameraStop?: () => void;
  onSwordToggle?: (enabled: boolean) => void;
  onReset?: () => void;
  onScreenshot?: () => void;
  onFullscreen?: () => void;
  onError?: (err: unknown) => void;
}

export interface UIElements {
  colorPicker: HTMLInputElement | null;
  colorValue: HTMLElement | null;
  modelBtns: NodeListOf<Element>;
  countSlider: HTMLInputElement | null;
  countValue: HTMLElement | null;
  sizeSlider: HTMLInputElement | null;
  sizeValue: HTMLElement | null;
  sensitivitySlider: HTMLInputElement | null;
  sensitivityValue: HTMLElement | null;
  startBtn: HTMLButtonElement | null;
  stopBtn: HTMLButtonElement | null;
  swordToggle: HTMLButtonElement | null;
  swordToggleLabel: HTMLElement | null;
  resetBtn: HTMLButtonElement | null;
  screenshotBtn: HTMLButtonElement | null;
  fullscreenBtn: HTMLButtonElement | null;
  cameraStatus: HTMLElement | null;
  gestureStatus: HTMLElement | null;
}

// --- GestureRecognizer types ---
export interface GestureRecognizerState {
  currentGesture: GestureType;
  gestureFrames: number;
  handPos: HandPosition;
  handVelocityX: number;
  handVelocityY: number;
  prevHandX: number;
  prevHandY: number;
  lastHandTime: number;
  fingerTip3D: { x: number; y: number; z: number } | null;
  prevFingerTip3D: { x: number; y: number; z: number } | null;
  peaceTarget: { x: number; y: number; z: number } | null;
  targetHandRotation: number;
  handRotation: number;
}

export interface GestureHistory {
  frames: GestureType[];
  lastGestureTime: number;
  stableGesture: GestureType;
  pendingGesture: GestureType;
  hysteresisCount: number;
}

export interface GestureChangePayload {
  gesture: GestureType;
  handPos?: HandPosition;
  fingerTip3D?: { x: number; y: number; z: number };
  peaceTarget?: { x: number; y: number; z: number };
  handOpenness?: number;
}

export interface GestureListeners {
  gestureChange: GestureChangeCallback[];
  handPosition: HandPositionCallback[];
  cameraStatus: CameraStatusCallback[];
}

export type GestureChangeCallback = (payload: GestureChangePayload) => void;
export type HandPositionCallback = (pos: HandPosition) => void;
export type CameraStatusCallback = (info: { status: string; message: string }) => void;

// --- ParticleSystem types ---
export interface ParticleSystemConfig {
  containerId?: string;
  defaultColor?: string;
  defaultModel?: string;
  defaultCount?: number;
  defaultSize?: number;
  defaultSensitivity?: number;
}

export interface ParticleSystemState {
  currentModel: string;
  particleColor: { r: number; g: number; b: number; set(value: string | number): void };
  particleCount: number;
  particleSize: number;
  gestureSensitivity: number;
  spreadFactor: number;
  targetSpread: number;
  targetPositions: Float32Array | null;
  handRotation: number;
  targetHandRotation: number;
  handActive: boolean;
  handPos: HandPosition;
}
