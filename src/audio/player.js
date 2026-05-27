// AudioPlayer — progressive playback via Web Audio API
// Accepts WAV Blobs or Float32Array PCM segments

export class AudioPlayer {
  constructor() {
    this.ctx = null;
    this.queue = [];
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

  onProgress(cb) { this._onProgress = cb; }
  onComplete(cb) { this._onComplete = cb; }
  onSegmentChange(cb) { this._onSegmentChange = cb; }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Load WAV Blobs or { audio: Float32Array } segments and play
   */
  async playSegments(segments) {
    this.stop();
    this.queue = [];
    this.currentIndex = 0;
    this._pauseOffset = 0;

    // Decode all segments upfront (WAV Blobs → AudioBuffers)
    this._ensureContext();
    for (const seg of segments) {
      if (seg instanceof Blob) {
        const buf = await seg.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(buf);
        this.queue.push(audioBuffer);
      } else if (seg.audio instanceof Float32Array) {
        const audioBuffer = this.ctx.createBuffer(1, seg.audio.length, seg.sampleRate || 22050);
        audioBuffer.getChannelData(0).set(seg.audio);
        this.queue.push(audioBuffer);
      } else if (seg instanceof Float32Array) {
        const audioBuffer = this.ctx.createBuffer(1, seg.length, 22050);
        audioBuffer.getChannelData(0).set(seg);
        this.queue.push(audioBuffer);
      }
    }

    await this._playCurrent();
  }

  async _playCurrent() {
    if (this.currentIndex >= this.queue.length) {
      this._playing = false;
      if (this._onComplete) this._onComplete();
      return;
    }

    this._ensureContext();

    const buffer = this.queue[this.currentIndex];
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

  resume() {
    if (this._playing) return;
    this._playCurrent();
  }

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

  _trackProgress() {
    if (!this._playing || !this._onProgress) return;

    const elapsed = (this.ctx.currentTime - this._startTime) * this._speed;
    const buf = this.queue[this.currentIndex];
    const duration = buf ? buf.duration : 1;

    this._onProgress({
      segmentIndex: this.currentIndex,
      totalSegments: this.queue.length,
      segmentTime: Math.min(elapsed, duration),
      segmentDuration: duration,
      overallProgress: (this.currentIndex + Math.min(elapsed, duration) / duration) / this.queue.length,
    });

    this._rafId = requestAnimationFrame(() => this._trackProgress());
  }
}
