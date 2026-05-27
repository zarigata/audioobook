// AudioPlayer — full-featured playback with seek, skip, speed, segments, keyboard

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

  get playing() { return this._playing; }
  get speed() { return this._speed; }
  get totalSegments() { return this.queue.length; }
  get currentSegmentIndex() { return this.currentIndex; }

  get totalDuration() {
    let total = 0;
    for (const buf of this.queue) total += buf.duration;
    return total;
  }

  get elapsedDuration() {
    if (!this.queue.length) return 0;
    let elapsed = 0;
    for (let i = 0; i < this.currentIndex; i++) {
      elapsed += this.queue[i].duration;
    }
    if (this._playing && this.ctx) {
      const segElapsed = (this.ctx.currentTime - this._startTime) * this._speed;
      elapsed += Math.min(segElapsed, this.queue[this.currentIndex]?.duration || 0);
    } else {
      elapsed += this._pauseOffset;
    }
    return elapsed;
  }

  set speed(rate) {
    this._speed = Math.max(0.5, Math.min(3.0, rate));
    if (this.source && this._playing) {
      this.source.playbackRate.value = this._speed;
    }
  }

  onProgress(cb) { this._onProgress = cb; }
  onComplete(cb) { this._onComplete = cb; }
  onSegmentChange(cb) { this._onSegmentChange = cb; }

  _ensureContext() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async loadSegments(segments) {
    this.stop();
    this.queue = [];
    this._ensureContext();

    for (const seg of segments) {
      if (seg instanceof Blob) {
        const buf = await seg.arrayBuffer();
        this.queue.push(await this.ctx.decodeAudioData(buf));
      } else if (seg?.audio instanceof Float32Array) {
        const ab = this.ctx.createBuffer(1, seg.audio.length, seg.sampleRate || 22050);
        ab.getChannelData(0).set(seg.audio);
        this.queue.push(ab);
      }
    }

    return this.queue.length;
  }

  play(segmentIndex = 0, offset = 0) {
    this._ensureContext();
    this.currentIndex = segmentIndex;
    this._pauseOffset = offset;
    this._playCurrent();
  }

  _playCurrent() {
    if (this.currentIndex >= this.queue.length) {
      this._playing = false;
      if (this._onComplete) this._onComplete();
      return;
    }

    this._ensureContext();
    this._stopSource();

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
      if (this._onSegmentChange) this._onSegmentChange(this.currentIndex, this.queue.length);
      this._playCurrent();
    };

    this.source.start(0, this._pauseOffset);
    this._playing = true;
    this._trackProgress();
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._pauseOffset = (this.ctx.currentTime - this._startTime) * this._speed;
    this._stopSource();
    cancelAnimationFrame(this._rafId);
  }

  resume() {
    if (this._playing) return;
    this._playCurrent();
  }

  stop() {
    this._playing = false;
    this._stopSource();
    cancelAnimationFrame(this._rafId);
    this.queue = [];
    this.currentIndex = 0;
    this._pauseOffset = 0;
  }

  _stopSource() {
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch {}
      this.source = null;
    }
  }

  /**
   * Skip forward/backward by seconds within current segment or across segments
   */
  skip(seconds) {
    if (!this.queue.length) return;

    const currentOffset = this._playing
      ? (this.ctx.currentTime - this._startTime) * this._speed
      : this._pauseOffset;

    let newOffset = currentOffset + seconds;
    let segmentIdx = this.currentIndex;

    // Navigate across segments
    while (newOffset < 0 && segmentIdx > 0) {
      segmentIdx--;
      newOffset += this.queue[segmentIdx].duration;
    }
    while (newOffset > this.queue[segmentIdx].duration && segmentIdx < this.queue.length - 1) {
      newOffset -= this.queue[segmentIdx].duration;
      segmentIdx++;
    }

    newOffset = Math.max(0, Math.min(newOffset, this.queue[segmentIdx]?.duration || 0));

    const wasPlaying = this._playing;
    this._playing = false;
    this._stopSource();

    this.currentIndex = segmentIdx;
    this._pauseOffset = newOffset;

    if (wasPlaying) {
      this._playCurrent();
    } else if (this._onProgress) {
      this._reportProgress(segmentIdx, newOffset);
    }
  }

  /**
   * Seek to a specific segment and offset
   */
  seekTo(segmentIndex, offset = 0) {
    if (segmentIndex < 0 || segmentIndex >= this.queue.length) return;

    const wasPlaying = this._playing;
    this._playing = false;
    this._stopSource();

    this.currentIndex = segmentIndex;
    this._pauseOffset = offset;

    if (wasPlaying) {
      this._playCurrent();
    } else if (this._onProgress) {
      this._reportProgress(segmentIndex, offset);
    }
  }

  /**
   * Seek to a position as fraction (0-1) of total duration
   */
  seekToFraction(fraction) {
    fraction = Math.max(0, Math.min(1, fraction));
    const targetTime = fraction * this.totalDuration;

    let accumulated = 0;
    for (let i = 0; i < this.queue.length; i++) {
      const dur = this.queue[i].duration;
      if (accumulated + dur >= targetTime) {
        this.seekTo(i, targetTime - accumulated);
        return;
      }
      accumulated += dur;
    }
  }

  _trackProgress() {
    if (!this._playing) return;

    const elapsed = (this.ctx.currentTime - this._startTime) * this._speed;
    const buf = this.queue[this.currentIndex];
    const duration = buf ? buf.duration : 1;

    if (this._onProgress) {
      this._onProgress({
        segmentIndex: this.currentIndex,
        totalSegments: this.queue.length,
        segmentTime: Math.min(elapsed, duration),
        segmentDuration: duration,
        overallProgress: this.elapsedDuration / this.totalDuration,
      });
    }

    this._rafId = requestAnimationFrame(() => this._trackProgress());
  }

  _reportProgress(segmentIndex, offset) {
    if (!this._onProgress) return;
    const buf = this.queue[segmentIndex];
    this._onProgress({
      segmentIndex,
      totalSegments: this.queue.length,
      segmentTime: offset,
      segmentDuration: buf ? buf.duration : 0,
      overallProgress: this.elapsedDuration / this.totalDuration,
    });
  }
}
