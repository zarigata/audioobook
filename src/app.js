import { createUploadUI } from './ui/upload.js';
import { parseDocument } from './parsers/index.js';
import { segmentText, splitIntoChunks } from './utils/segmenter.js';
import { BrowserTTS } from './tts/browser-tts.js';
import { TTSWorkerManager } from './tts/worker-manager.js';
import { AudioPlayer } from './audio/player.js';
import { encodeMp3, encodeWav, concatenateAudio, downloadBlob } from './audio/encoder.js';
import strings from './ui/i18n.js';

const STATES = {
  IDLE: 'idle',
  PARSING: 'parsing',
  MODE_SELECT: 'mode_select',
  GENERATING: 'generating',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  ERROR: 'error',
};

export class App {
  constructor() {
    this.state = STATES.IDLE;
    this.file = null;
    this.format = null;
    this.rawText = '';
    this.segments = [];
    this.chunks = [];
    this.wavBlobs = [];
    this.mode = null;
    this.browserTTS = null;
    this.worker = null;
    this.player = new AudioPlayer();
  }

  mount() {
    this.uploadArea = document.getElementById('upload-area');
    this.playerArea = document.getElementById('player-area');
    this.progressArea = document.getElementById('progress-area');
    this._showUpload();
  }

  _setState(newState) {
    this.state = newState;
    this._render();
  }

  _showUpload() {
    this.playerArea.style.display = 'none';
    this.progressArea.style.display = 'none';
    this.uploadArea.style.display = '';

    createUploadUI(this.uploadArea, (file, format) => {
      this.file = file;
      this.format = format;
      this._parseFile();
    });
  }

  async _parseFile() {
    this._setState(STATES.PARSING);
    this._showProgress(strings.progress.parsing);

    try {
      this.rawText = await parseDocument(this.file, this.format, (p) => {
        this._showProgress(strings.progress.parsing, p);
      });

      this.segments = segmentText(this.rawText);
      this.chunks = splitIntoChunks(this.segments);

      if (this.chunks.length === 0) {
        throw new Error(strings.errors.noText);
      }

      this._setState(STATES.MODE_SELECT);
    } catch (err) {
      this._showError(err.message);
    }
  }

  _renderModeSelect() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = 'none';
    this.progressArea.style.display = '';

    this.progressArea.innerHTML = `
      <div class="mode-select">
        <p class="mode-info">${this._esc(this.file.name)} — ${this.chunks.length} segmentos</p>
        <h3>${strings.mode.select}</h3>
        <div class="mode-buttons">
          <button class="mode-btn" data-mode="fast">
            <strong>⚡ ${strings.mode.fast}</strong>
            <span>${strings.mode.fastDesc}</span>
          </button>
          <button class="mode-btn" data-mode="quality">
            <strong>🎙 ${strings.mode.quality}</strong>
            <span>${strings.mode.qualityDesc}</span>
          </button>
        </div>
        <button class="btn-secondary" id="btn-back-upload">${strings.actions.newFile}</button>
      </div>
    `;

    this.progressArea.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        this._startGeneration();
      });
    });

    this.progressArea.querySelector('#btn-back-upload').addEventListener('click', () => {
      this._reset();
    });
  }

  async _startGeneration() {
    this._setState(STATES.GENERATING);

    try {
      if (this.mode === 'fast') {
        await this._generateFast();
      } else {
        await this._generateQuality();
      }

      this._setState(STATES.COMPLETE);
    } catch (err) {
      if (err.message !== 'canceled') {
        this._showError(err.message);
      }
    }
  }

  async _generateFast() {
    this.browserTTS = new BrowserTTS();
    await this.browserTTS.init();

    if (this.browserTTS.availableVoices.length === 0) {
      throw new Error(strings.errors.noVoice);
    }

    this._showProgress(strings.actions.generating);

    await this.browserTTS.speak(this.chunks, 0, (current, total) => {
      this._showProgress(
        strings.progress.generating
          .replace('{current}', current)
          .replace('{total}', total),
        current / total,
      );
    });
  }

  async _generateQuality() {
    this.worker = new TTSWorkerManager();
    await this.worker.init();

    this._showProgress(strings.voice.downloading, 0);
    await this.worker.downloadVoice('pt_BR-faber-medium', (progress) => {
      this._showProgress(
        strings.voice.downloadProgress.replace('{percent}', Math.round(progress * 100)),
        progress,
      );
    });

    // Generate WAV Blobs via worker (returns Float32Array PCM after decoding WAV)
    this.wavBlobs = [];
    const pcmSegments = await this.worker.generateAll(this.chunks, (current, total) => {
      this._showProgress(
        strings.progress.generating
          .replace('{current}', current)
          .replace('{total}', total),
        current / total,
      );
    });

    // Store as { audio: Float32Array } for playback/encoding
    this.wavBlobs = pcmSegments;
  }

  _startPlayback() {
    this._setState(STATES.PLAYING);

    // For quality mode: reconstruct WAV Blobs from PCM for playback
    if (this.mode === 'quality' && this.wavBlobs.length > 0) {
      const wavBlobsForPlayback = this.wavBlobs.map((pcm) => {
        const audio = pcm.audio || pcm;
        return encodeWav(audio, 22050);
      });
      this.player.playSegments(wavBlobsForPlayback);
    }

    this.player.onSegmentChange((current, total) => {
      this._updatePlaybackUI(current, total);
    });

    this.player.onProgress((info) => {
      this._updatePlaybackProgress(info);
    });

    this.player.onComplete(() => {
      this._setState(STATES.COMPLETE);
    });
  }

  _pausePlayback() {
    this.player.pause();
    this._setState(STATES.PAUSED);
  }

  _resumePlayback() {
    this.player.resume();
    this._setState(STATES.PLAYING);
  }

  _stopPlayback() {
    this.player.stop();
    this._setState(STATES.COMPLETE);
  }

  async _downloadMp3() {
    this._showProgress(strings.progress.encoding);
    const { audio, sampleRate } = await concatenateAudio(this.wavBlobs);
    const blob = await encodeMp3(audio, sampleRate);
    const name = this.file.name.replace(/\.[^.]+$/, '') + '.mp3';
    downloadBlob(blob, name);
    this._render();
  }

  async _downloadWav() {
    this._showProgress(strings.progress.encoding);
    const { audio, sampleRate } = await concatenateAudio(this.wavBlobs);
    const blob = encodeWav(audio, sampleRate);
    const name = this.file.name.replace(/\.[^.]+$/, '') + '.wav';
    downloadBlob(blob, name);
    this._render();
  }

  _render() {
    switch (this.state) {
      case STATES.MODE_SELECT:
        this._renderModeSelect();
        break;
      case STATES.PLAYING:
      case STATES.PAUSED:
        this._renderPlayer();
        break;
      case STATES.COMPLETE:
        this._renderComplete();
        break;
    }
  }

  _renderPlayer() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = '';
    this.progressArea.style.display = 'none';

    const isPlaying = this.state === STATES.PLAYING;

    this.playerArea.innerHTML = `
      <div class="player">
        <div class="player-info">
          <span class="player-file">${this._esc(this.file.name)}</span>
          <span class="player-segment" id="player-segment"></span>
        </div>
        <div class="player-controls">
          <button id="btn-play-pause" class="btn-primary">
            ${isPlaying ? strings.actions.pause : strings.actions.play}
          </button>
          <button id="btn-stop" class="btn-secondary">${strings.actions.stop}</button>
        </div>
        <div class="player-speed">
          <label>${strings.speed.label}:
            <input type="range" id="speed-range" min="0.5" max="2" step="0.1" value="${this.player.speed}" />
            <span id="speed-value">${this.player.speed.toFixed(1)}x</span>
          </label>
        </div>
      </div>
    `;

    this.playerArea.querySelector('#btn-play-pause').addEventListener('click', () => {
      if (isPlaying) this._pausePlayback();
      else this._resumePlayback();
    });

    this.playerArea.querySelector('#btn-stop').addEventListener('click', () => {
      this._stopPlayback();
    });

    const speedRange = this.playerArea.querySelector('#speed-range');
    const speedValue = this.playerArea.querySelector('#speed-value');
    speedRange.addEventListener('input', () => {
      const val = parseFloat(speedRange.value);
      this.player.speed = val;
      speedValue.textContent = val.toFixed(1) + 'x';
    });
  }

  _renderComplete() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = '';
    this.progressArea.style.display = '';

    const hasAudio = this.wavBlobs.length > 0;
    const isFastMode = this.mode === 'fast';

    this.playerArea.innerHTML = `
      <div class="player complete">
        <p class="complete-title">✅ ${strings.progress.complete}</p>
        ${hasAudio ? `
          <div class="player-controls">
            <button id="btn-play" class="btn-primary">${strings.actions.play}</button>
            <button id="btn-download-mp3" class="btn-secondary">${strings.actions.download}</button>
            <button id="btn-download-wav" class="btn-secondary">${strings.actions.downloadWav}</button>
          </div>
        ` : ''}
        ${isFastMode ? `
          <p class="mode-info">${strings.errors.browserTtsNoExport}</p>
        ` : ''}
      </div>
    `;

    if (hasAudio) {
      this.playerArea.querySelector('#btn-play').addEventListener('click', () => {
        this._startPlayback();
      });
      this.playerArea.querySelector('#btn-download-mp3').addEventListener('click', () => {
        this._downloadMp3();
      });
      this.playerArea.querySelector('#btn-download-wav').addEventListener('click', () => {
        this._downloadWav();
      });
    }

    this.progressArea.innerHTML = `
      <button class="btn-secondary" id="btn-new-file">${strings.actions.newFile}</button>
    `;
    this.progressArea.querySelector('#btn-new-file').addEventListener('click', () => {
      this._reset();
    });
  }

  _showProgress(message, progress) {
    this.progressArea.style.display = '';
    const pct = progress ? ` (${Math.round(progress * 100)}%)` : '';
    this.progressArea.innerHTML = `
      <div class="progress">
        <p class="progress-text">${this._esc(message)}${pct}</p>
        ${progress !== undefined ? `
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.round(progress * 100)}%"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _showError(message) {
    this._setState(STATES.ERROR);
    this.progressArea.style.display = '';
    this.progressArea.innerHTML = `
      <div class="error">
        <p>❌ ${this._esc(message)}</p>
        <button class="btn-secondary" id="btn-retry">${strings.actions.newFile}</button>
      </div>
    `;
    this.progressArea.querySelector('#btn-retry').addEventListener('click', () => {
      this._reset();
    });
  }

  _updatePlaybackUI(current, total) {
    const el = document.getElementById('player-segment');
    if (el) el.textContent = `${current}/${total}`;
  }

  _updatePlaybackProgress(info) {
    const el = document.getElementById('player-segment');
    if (el) {
      const pct = info.segmentDuration > 0
        ? Math.round((info.segmentTime / info.segmentDuration) * 100)
        : 0;
      el.textContent = `${info.segmentIndex + 1}/${info.totalSegments} — ${pct}%`;
    }
  }

  _reset() {
    if (this.browserTTS) this.browserTTS.cancel();
    if (this.player) this.player.stop();
    if (this.worker) this.worker.terminate();
    this.file = null;
    this.format = null;
    this.rawText = '';
    this.segments = [];
    this.chunks = [];
    this.wavBlobs = [];
    this.mode = null;
    this.browserTTS = null;
    this.worker = null;
    this._setState(STATES.IDLE);
    this._showUpload();
  }

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
