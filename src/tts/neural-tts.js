// NeuralTTS — Piper TTS via @diffusionstudio/vits-web
// predict() returns a WAV Blob — must decode properly for playback/encoding

const DEFAULT_VOICE = 'pt_BR-faber-medium';

const VOICE_OPTIONS = [
  { id: 'pt_BR-faber-medium', label: 'Faber (masculino)' },
  { id: 'pt_BR-edresson-low', label: 'Edresson (masculino)' },
  { id: 'pt_PT-tugão-medium', label: 'Tugão (Portugal)' },
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
    this._modelReady = false;
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

  async init() {
    if (this._tts) return;
    const vits = await import('@diffusionstudio/vits-web');
    this._tts = vits;
  }

  async downloadVoice(onProgress = () => {}) {
    await this.init();
    await this._tts.download(this._voiceId, (event) => {
      if (event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });
    this._modelReady = true;
  }

  async getCachedVoices() {
    await this.init();
    return this._tts.stored();
  }

  /**
   * Generate audio for one text segment.
   * @returns {Promise<Blob>} WAV Blob from Piper
   */
  async generate(text) {
    if (!this._modelReady) {
      throw new Error('Modelo não carregado. Chame downloadVoice() primeiro.');
    }
    return this._tts.predict({ text, voiceId: this._voiceId });
  }

  /**
   * Generate WAV Blobs for multiple segments.
   * @param {string[]} segments
   * @param {(index: number, total: number) => void} onProgress
   * @returns {Promise<Blob[]>} Array of WAV Blobs
   */
  async generateAll(segments, onProgress = () => {}) {
    const blobs = [];
    for (let i = 0; i < segments.length; i++) {
      const wav = await this.generate(segments[i]);
      blobs.push(wav);
      onProgress(i + 1, segments.length);
    }
    return blobs;
  }
}
