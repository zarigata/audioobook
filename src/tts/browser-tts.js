// BrowserTTS — Web Speech API wrapper for fast mode (Portuguese voices only)
// Listen-only: no MP3 export from browser voices (GRD-1)

const CHROME_MAX_UTTERANCE_MS = 15000; // Chrome cuts speech at ~15s

export class BrowserTTS {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.currentUtterance = null;
    this._voicesLoaded = false;
    this._speed = 1.0;
  }

  /**
   * Load and filter for Portuguese voices
   */
  async init() {
    this.voices = await this._loadVoices();
    const ptVoices = this.voices.filter((v) =>
      v.lang.startsWith('pt') || v.lang.startsWith('pt-BR'),
    );
    // Prefer pt-BR voices
    ptVoices.sort((a, b) => {
      if (a.lang === 'pt-BR' && b.lang !== 'pt-BR') return -1;
      if (b.lang === 'pt-BR' && a.lang !== 'pt-BR') return 1;
      return 0;
    });
    this.voices = ptVoices.length > 0 ? ptVoices : this.voices;
    this._voicesLoaded = true;
  }

  get isReady() {
    return this._voicesLoaded;
  }

  get availableVoices() {
    return this.voices.map((v) => ({
      name: v.name,
      lang: v.lang,
      local: v.localService,
    }));
  }

  set speed(rate) {
    this._speed = Math.max(0.5, Math.min(2.0, rate));
  }

  get speed() {
    return this._speed;
  }

  /**
   * Speak a list of text segments sequentially
   * @param {string[]} segments - Sentences/paragraphs to speak
   * @param {number} [voiceIndex=0] - Voice index from availableVoices
   * @param {(index: number, total: number) => void} onProgress
   * @returns {Promise<void>}
   */
  async speak(segments, voiceIndex = 0, onProgress = () => {}) {
    this.cancel();

    const voice = this.voices[voiceIndex] || this.voices[0];
    if (!voice) throw new Error('Nenhuma voz em português disponível');

    for (let i = 0; i < segments.length; i++) {
      if (!this.currentUtterance) break; // cancelled

      onProgress(i, segments.length);
      await this._speakSegment(segments[i], voice);
    }

    onProgress(segments.length, segments.length);
  }

  /**
   * Speak a single segment, working around Chrome's 15s cutoff
   */
  _speakSegment(text, voice) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.rate = this._speed;
      utterance.lang = voice.lang;

      // Chrome workaround: resume synth on boundary events
      // Chrome pauses synthesis after ~15s of continuous speech
      let lastBoundary = Date.now();
      const resumeInterval = setInterval(() => {
        if (Date.now() - lastBoundary > 10000) {
          this.synth.pause();
          this.synth.resume();
          lastBoundary = Date.now();
        }
      }, 10000);

      utterance.onboundary = () => {
        lastBoundary = Date.now();
      };

      utterance.onend = () => {
        clearInterval(resumeInterval);
        resolve();
      };

      utterance.onerror = (e) => {
        clearInterval(resumeInterval);
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve(); // Normal cancel
        } else {
          reject(new Error(`Erro na síntese: ${e.error}`));
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  /**
   * Cancel current speech
   */
  cancel() {
    this.currentUtterance = null;
    this.synth.cancel();
  }

  /**
   * Pause current speech
   */
  pause() {
    this.synth.pause();
  }

  /**
   * Resume current speech
   */
  resume() {
    this.synth.resume();
  }

  /**
   * Load voices — handles async voice loading in some browsers
   */
  _loadVoices() {
    return new Promise((resolve) => {
      let voices = this.synth.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      const onVoicesChanged = () => {
        voices = this.synth.getVoices();
        if (voices.length > 0) {
          this.synth.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(voices);
        }
      };

      this.synth.addEventListener('voiceschanged', onVoicesChanged);

      // Timeout fallback: some browsers never fire voiceschanged
      setTimeout(() => {
        this.synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(this.synth.getVoices());
      }, 3000);
    });
  }
}
