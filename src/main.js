import './style.css';
import { App } from './app.js';

// Register Service Worker for COOP/COEP (SharedArrayBuffer for Piper TTS)
if ('serviceWorker' in navigator) {
  const swPath = import.meta.env.BASE_URL + 'sw.js';
  navigator.serviceWorker.register(swPath).then((reg) => {
    console.log('Service Worker registrado:', reg.scope);
  }).catch((err) => {
    console.warn('Service Worker não registrado (requer HTTPS):', err.message);
  });
}

const app = new App();
app.mount();
