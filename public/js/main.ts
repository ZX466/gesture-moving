import { ParticleSystem } from './ParticleSystem.js';

const particleSystem = new ParticleSystem();
particleSystem.init();

declare global {
  interface Window { particleSystem: ParticleSystem }
}
(window as unknown as { particleSystem: ParticleSystem }).particleSystem = particleSystem;
