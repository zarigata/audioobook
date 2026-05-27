// TTSWorkerManager — manages the Web Worker for off-thread Piper inference

export class TTSWorkerManager {
  constructor() {
    this.worker = null;
    this._pending = new Map();
    this._nextId = 1;
  }

  /**
   * Initialize the worker
   */
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

    this.worker.onerror = (err) => {
      console.error('TTS Worker erro:', err);
    };

    // Wait for worker to be ready
    await this._send('init');
  }

  /**
   * Download a Piper voice model in the worker
   */
  async downloadVoice(voiceId, onProgress) {
    return this._send('download', { voiceId }, onProgress);
  }

  /**
   * Generate audio for a text segment
   */
  async generate(text) {
    return this._send('generate', { text });
  }

  /**
   * Generate audio for all segments
   */
  async generateAll(segments, onProgress = () => {}) {
    const results = [];
    for (let i = 0; i < segments.length; i++) {
      const audio = await this.generate(segments[i]);
      results.push(audio);
      onProgress(i + 1, segments.length);
    }
    return results;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this._pending.clear();
  }

  /**
   * Send message to worker and wait for response
   */
  _send(type, data = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, type, ...data });
    });
  }
}
