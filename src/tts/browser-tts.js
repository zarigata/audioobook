// BrowserTTS — Web Speech API wrapper for fast mode
// Handles: async voice loading, lang format variants (pt-BR/pt_br/por-BR), Chrome 15s bug

export class BrowserTTS {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.currentUtterance = null;
    this._voicesLoaded = false;
    this._speed = 1.0;
    this._resumeInterval = null;
  }

  async init() {
    this.voices = await this._loadVoices();
    this._voicesLoaded = true;

    if (this.voices.length === 0) {
      console.warn('Nenhuma voz em português encontrada');
    }
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
   */
  async speak(segments, voiceIndex = 0, onProgress = () => {}) {
    this.cancel();

    const voice = this.voices[voiceIndex] || this.voices[0];
    if (!voice) throw new Error('Nenhuma voz em português disponível');

    const isNonLocalDesktop = !voice.localService && !this._isAndroid();

    for (let i = 0; i < segments.length; i++) {
      if (!this.currentUtterance) break;

      onProgress(i, segments.length);
      await this._speakSegment(segments[i], voice, isNonLocalDesktop);
    }

    onProgress(segments.length, segments.length);
  }

  /**
   * Speak one segment, working around Chrome's 15s cutoff on non-local voices
   */
  _speakSegment(text, voice, needsChromeWorkaround) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.rate = this._speed;
      utterance.lang = voice.lang;

      // Chrome desktop workaround: pause/resume every 10s for cloud voices
      if (needsChromeWorkaround) {
        this._resumeInterval = setInterval(() => {
          if (this.synth.speaking && !this.synth.paused) {
            this.synth.pause();
            this.synth.resume();
          }
        }, 10000);
      }

      utterance.onend = () => {
        clearInterval(this._resumeInterval);
        this._resumeInterval = null;
        resolve();
      };

      utterance.onerror = (e) => {
        clearInterval(this._resumeInterval);
        this._resumeInterval = null;
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Erro na síntese: ${e.error}`));
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  cancel() {
    clearInterval(this._resumeInterval);
    this._resumeInterval = null;
    this.currentUtterance = null;
    this.synth.cancel();
  }

  pause() {
    if (this._isAndroid()) return; // pause() = cancel() on Android
    this.synth.pause();
  }

  resume() {
    if (this._isAndroid()) return;
    this.synth.resume();
  }

  /**
   * Normalize voice.lang to handle browser variants:
   * - Chrome/Edge/Safari/Firefox desktop: "pt-BR"
   * - Chrome Android: "pt_br"
   * - Firefox Android: "por-BR-f000"
   */
  _normalizeLang(lang) {
    if (!lang) return '';
    const lower = lang.toLowerCase();

    // Handle 3-letter codes: por→pt
    const threeLetter = lower.match(/^([a-z]{3})[_-]/);
    if (threeLetter) {
      const map = { por: 'pt', eng: 'en', deu: 'de', fra: 'fr', spa: 'es' };
      const mapped = map[threeLetter[1]];
      if (mapped) return lower.replace(threeLetter[1], mapped);
    }

    return lower;
  }

  _isPortuguese(voice) {
    const normalized = this._normalizeLang(voice.lang);
    return normalized.startsWith('pt');
  }

  _isBrazilian(voice) {
    const normalized = this._normalizeLang(voice.lang);
    return normalized.includes('br');
  }

  _isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  /**
   * Load voices with async handling
   */
  _loadVoices() {
    return new Promise((resolve) => {
      const allVoices = this.synth.getVoices();

      const filterPortuguese = (voices) => {
        const ptVoices = voices.filter((v) => this._isPortuguese(v));

        // Sort: pt-BR first, then local voices first (no Chrome 15s bug)
        ptVoices.sort((a, b) => {
          const aBR = this._isBrazilian(a) ? 0 : 1;
          const bBR = this._isBrazilian(b) ? 0 : 1;
          if (aBR !== bBR) return aBR - bBR;

          const aLocal = a.localService ? 0 : 1;
          const bLocal = b.localService ? 0 : 1;
          return aLocal - bLocal;
        });

        return ptVoices;
      };

      if (allVoices.length > 0) {
        resolve(filterPortuguese(allVoices));
        return;
      }

      const onVoicesChanged = () => {
        const voices = this.synth.getVoices();
        if (voices.length > 0) {
          this.synth.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(filterPortuguese(voices));
        }
      };

      this.synth.addEventListener('voiceschanged', onVoicesChanged);

      setTimeout(() => {
        this.synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(filterPortuguese(this.synth.getVoices()));
      }, 3000);
    });
  }
}
