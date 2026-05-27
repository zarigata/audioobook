// NeuralTTS — Piper TTS via @diffusionstudio/vits-web for quality mode
// Portuguese voices: pt_BR-edresson-medium, pt_BR-faber-medium, pt_BR-juliette-medium

const DEFAULT_VOICE = 'pt_BR-faber-medium';

const VOICE_OPTIONS = [
  { id: 'pt_BR-faber-medium', label: 'Faber (masculino)' },
  { id: 'pt_BR-edresson-medium', label: 'Edresson (masculino)' },
  { id: 'pt_BR-juliette-medium', label: 'Juliette (feminino)' },
];

export class NeuralTTS {
  constructor() {
    this._tts = null;
    this._voiceId = DEFAULT_VOICE;
    this._speed = 1.0;
    this._modelReady = false;
  }

  get voiceOptions() {
    return VOICE_OPTIONS;
  }

  get isReady() {
    return this._modelReady;
  }

  set voiceId(id) {
    this._voiceId = id;
    this._modelReady = false; // need to re-download if different voice
  }

  get voiceId() {
    return this._voiceId;
  }

  set speed(rate) {
    this._speed = Math.max(0.5, Math.min(2.0, rate));
  }

  get speed() {
    return this._speed;
  }

  /**
   * Initialize: lazy-load the vits-web library
   */
  async init() {
    if (this._tts) return;

    const vits = await import('@diffusionstudio/vits-web');
    this._tts = vits;
  }

  /**
   * Download the selected voice model (with progress)
   * @param {(progress: number) => void} onProgress - 0 to 1
   */
  async downloadVoice(onProgress = () => {}) {
    await this.init();

    await this._tts.download(this._voiceId, (event) => {
      if (event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });

    this._modelReady = true;
  }

  /**
   * Check which voices are already cached locally
   * @returns {Promise<string[]>}
   */
  async getCachedVoices() {
    await this.init();
    const stored = await this._tts.stored();
    return stored;
  }

  /**
   * Generate audio for a single text segment
   * @param {string} text
   * @returns {Promise<Float32Array>} PCM audio data at 22050Hz
   */
  async generate(text) {
    if (!this._modelReady) {
      throw new Error('Modelo não carregado. Chame downloadVoice() primeiro.');
    }

    const result = await this._tts.predict({
      text,
      voiceId: this._voiceId,
    });

    // predict returns Blob, ArrayBuffer, or AudioBuffer depending on version
    if (result instanceof Float32Array) return result;
    if (result instanceof ArrayBuffer) return new Float32Array(result);
    if (result instanceof Blob) {
      const buffer = await result.arrayBuffer();
      return new Float32Array(buffer);
    }
    // AudioBuffer
    if (result && result.getChannelData) {
      return result.getChannelData(0);
    }

    throw new Error('Formato de áudio inesperado do Piper');
  }

  /**
   * Generate audio for multiple segments sequentially
   * @param {string[]} segments
   * @param {(index: number, total: number, audio: Float32Array) => void} onProgress
   * @returns {Promise<Float32Array[]>}
   */
  async generateAll(segments, onProgress = () => {}) {
    const results = [];

    for (let i = 0; i < segments.length; i++) {
      const audio = await this.generate(segments[i]);
      results.push(audio);
      onProgress(i + 1, segments.length, audio);
    }

    return results;
  }
}
