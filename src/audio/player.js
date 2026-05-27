// AudioPlayer — progressive audio playback via Web Audio API
// Handles segment queue, speed control, pause/resume, time tracking

export class AudioPlayer {
  constructor() {
    this.ctx = null; // AudioContext — lazy init on user gesture
    this.queue = []; // { audio: Float32Array, sampleRate: number }
    this.currentIndex = 0;
    this.source = null;
    this._playing = false;
    this._speed = 1.0;
    this._startTime = 0;
    this._pauseOffset = 0;
    this._onProgress = null;
    this._onComplete = null;
    this._onSegmentChange = null;
    this._rafId = null;
    this.sampleRate = 22050; // Piper default
  }

  get playing() {
    return this._playing;
  }

  get speed() {
    return this._speed;
  }

  set speed(rate) {
    this._speed = Math.max(0.5, Math.min(3.0, rate));
  }

  /**
   * Set callbacks
   */
  onProgress(cb) { this._onProgress = cb; }
  onComplete(cb) { this._onComplete = cb; }
  onSegmentChange(cb) { this._onSegmentChange = cb; }

  /**
   * Initialize AudioContext (must be called from user gesture)
   */
  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Load audio segments into queue and start playback
   */
  async playSegments(segments) {
    this.stop();
    this.queue = segments;
    this.currentIndex = 0;
    this._pauseOffset = 0;
    await this._playCurrent();
  }

  /**
   * Play current segment from a specific offset
   */
  async _playCurrent() {
    if (this.currentIndex >= this.queue.length) {
      this._playing = false;
      if (this._onComplete) this._onComplete();
      return;
    }

    this._ensureContext();

    const segment = this.queue[this.currentIndex];
    const audio = segment.audio || segment;
    const sampleRate = segment.sampleRate || this.sampleRate;

    const buffer = this.ctx.createBuffer(1, audio.length, sampleRate);
    buffer.getChannelData(0).set(audio);

    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.playbackRate.value = this._speed;
    this.source.connect(this.ctx.destination);

    this._startTime = this.ctx.currentTime - this._pauseOffset / this._speed;

    this.source.onended = () => {
      if (!this._playing) return;
      this.currentIndex++;
      this._pauseOffset = 0;
      if (this._onSegmentChange) {
        this._onSegmentChange(this.currentIndex, this.queue.length);
      }
      this._playCurrent();
    };

    this.source.start(0, this._pauseOffset);
    this._playing = true;
    this._trackProgress();
  }

  /**
   * Pause playback
   */
  pause() {
    if (!this._playing) return;
    this._playing = false;

    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source = null;
    }

    this._pauseOffset = (this.ctx.currentTime - this._startTime) * this._speed;
    cancelAnimationFrame(this._rafId);
  }

  /**
   * Resume playback
   */
  resume() {
    if (this._playing) return;
    this._playCurrent();
  }

  /**
   * Stop and reset
   */
  stop() {
    this._playing = false;

    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch {}
      this.source = null;
    }

    cancelAnimationFrame(this._rafId);
    this.queue = [];
    this.currentIndex = 0;
    this._pauseOffset = 0;
  }

  /**
   * Track progress via requestAnimationFrame
   */
  _trackProgress() {
    if (!this._playing || !this._onProgress) return;

    const elapsed = (this.ctx.currentTime - this._startTime) * this._speed;
    const currentDuration = this.queue[this.currentIndex]
      ? (this.queue[this.currentIndex].audio || this.queue[this.currentIndex]).length / this.sampleRate
      : 0;

    this._onProgress({
      segmentIndex: this.currentIndex,
      totalSegments: this.queue.length,
      segmentTime: Math.min(elapsed, currentDuration),
      segmentDuration: currentDuration,
      overallProgress: (this.currentIndex + elapsed / currentDuration) / this.queue.length,
    });

    this._rafId = requestAnimationFrame(() => this._trackProgress());
  }
}
