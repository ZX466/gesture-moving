import { ParticleSystem } from './ParticleSystem.js';
import { injectSpeedInsights } from './speed-insights.mjs';

// Initialize Speed Insights
injectSpeedInsights();

const particleSystem = new ParticleSystem();
particleSystem.init();

declare global {
  interface Window { particleSystem: ParticleSystem }
}
(window as unknown as { particleSystem: ParticleSystem }).particleSystem = particleSystem;
