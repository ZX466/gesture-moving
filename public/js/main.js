import { ParticleSystem } from './ParticleSystem.js';
import { injectSpeedInsights } from './speed-insights.mjs';

// Initialize Speed Insights
injectSpeedInsights();

document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem();
    particleSystem.init();
    window.particleSystem = particleSystem;
});