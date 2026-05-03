import { ParticleSystem } from './ParticleSystem.js';

document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem();
    particleSystem.init();
    window.particleSystem = particleSystem;
});