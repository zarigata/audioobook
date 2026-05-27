// TTSWorkerManager — manages Web Worker with parallel generation and retry

export class TTSWorkerManager {
  constructor() {
    this.worker = null;
    this._pending = new Map();
    this._nextId = 1;
  }

  async init() {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('./worker.js', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (event) => {
      const { id, type } = event.data;
      const pending = this._pending.get(id);
      if (!pending) return;

      switch (type) {
        case 'audio':
          pending.resolve(new Float32Array(event.data.audio));
          this._pending.delete(id);
          break;
        case 'download-progress':
          if (pending.onProgress) pending.onProgress(event.data.progress);
          break;
        case 'download-complete':
          pending.resolve(true);
          this._pending.delete(id);
          break;
        case 'ready':
          pending.resolve(true);
          this._pending.delete(id);
          break;
        case 'error':
          pending.reject(new Error(event.data.error));
          this._pending.delete(id);
          break;
      }
    };

    this.worker.onerror = (err) => console.error('TTS Worker erro:', err);
    await this._send('init');
  }

  async downloadVoice(voiceId, onProgress) {
    return this._send('download', { voiceId }, onProgress);
  }

  async generate(text) {
    return this._send('generate', { text });
  }

  /**
   * Generate with retry on failure (up to maxRetries)
   */
  async generateWithRetry(text, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.generate(text);
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Generate all segments sequentially with retry and progress
   */
  async generateAll(segments, onProgress = () => {}) {
    const results = [];
    for (let i = 0; i < segments.length; i++) {
      const audio = await this.generateWithRetry(segments[i]);
      results.push({ audio, sampleRate: 22050 });
      onProgress(i + 1, segments.length);
    }
    return results;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this._pending.clear();
  }

  _send(type, data = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, type, ...data });
    });
  }
}
