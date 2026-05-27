import { createUploadUI } from './ui/upload.js';
import { parseDocument } from './parsers/index.js';
import { segmentText, splitIntoChunks } from './utils/segmenter.js';
import { BrowserTTS } from './tts/browser-tts.js';
import { TTSWorkerManager } from './tts/worker-manager.js';
import { AudioPlayer } from './audio/player.js';
import { encodeMp3, encodeWav, concatenateAudio, downloadBlob, normalizeAudio, trimSilence } from './audio/encoder.js';
import { showToast } from './ui/toast.js';
import strings from './ui/i18n.js';

const STATES = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', MODE_SELECT: 'mode_select', GENERATING: 'generating', PLAYING: 'playing', PAUSED: 'paused', COMPLETE: 'complete', ERROR: 'error' };
const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const MP3_BITRATES = [64, 128, 192, 256];
const VOICE_OPTIONS = [
  { id: 'pt_BR-faber-medium', label: strings.voice.faber },
  { id: 'pt_BR-edresson-low', label: strings.voice.edresson },
  { id: 'pt_PT-tugão-medium', label: strings.voice.tugao },
];
const SAMPLE_TEXT = 'Olá, bem-vindo ao AudiooBook. Esta é uma amostra da voz que será usada para gerar seu áudio.';

export class App {
  constructor() {
    this.state = STATES.IDLE;
    this.file = null;
    this.format = null;
    this.rawText = '';
    this.segments = [];
    this.chunks = [];
    this.audioSegments = [];
    this.mode = null;
    this.selectedVoice = VOICE_OPTIONS[0].id;
    this.mp3Bitrate = 128;
    this.browserTTS = null;
    this.worker = null;
    this.player = new AudioPlayer();
    this._genStartTime = 0;
    this._canceled = false;
    this._previewAudio = null;
  }

  mount() {
    this.uploadArea = document.getElementById('upload-area');
    this.playerArea = document.getElementById('player-area');
    this.progressArea = document.getElementById('progress-area');
    this._initDarkMode();
    this._initKeyboardShortcuts();
    this._showUpload();
  }

  _setState(s) { this.state = s; this._render(); }

  // ── Dark Mode ──

  _initDarkMode() {
    const saved = localStorage.getItem('audiobook-dark');
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }

  _toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('audiobook-dark', document.documentElement.classList.contains('dark'));
    this._render();
  }

  // ── Keyboard Shortcuts ──

  _initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (this.state === STATES.PLAYING) this._pausePlayback();
          else if (this.state === STATES.PAUSED) this._resumePlayback();
          else if (this.state === STATES.COMPLETE && this.audioSegments.length) this._startPlayback();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (this.player.queue.length) this.player.skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (this.player.queue.length) this.player.skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (this.player.queue.length) {
            const idx = SPEED_PRESETS.indexOf(this.player.speed);
            if (idx < SPEED_PRESETS.length - 1) this.player.speed = SPEED_PRESETS[idx + 1];
            this._render();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (this.player.queue.length) {
            const idx = SPEED_PRESETS.indexOf(this.player.speed);
            if (idx > 0) this.player.speed = SPEED_PRESETS[idx - 1];
            this._render();
          }
          break;
        case 'KeyM':
          this._toggleDarkMode();
          break;
      }
    });
  }

  // ── Upload ──

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

  // ── Parsing ──

  async _parseFile() {
    this._setState(STATES.PARSING);
    this._showSkeletonProgress(strings.progress.parsing);

    try {
      this.rawText = await parseDocument(this.file, this.format, (p) => {
        this._showSkeletonProgress(strings.progress.parsing, p);
      });

      this.segments = segmentText(this.rawText);
      this.chunks = splitIntoChunks(this.segments);

      if (this.chunks.length === 0) throw new Error(strings.errors.noText);

      this._setState(STATES.PREVIEW);
      showToast('Arquivo carregado com sucesso!', 'success');
    } catch (err) {
      this._showError(err.message);
    }
  }

  // ── Text Preview + Word Count + ETA ──

  _renderPreview() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = 'none';
    this.progressArea.style.display = '';

    const wordCount = this.rawText.split(/\s+/).filter(Boolean).length;
    const estMinutes = Math.round(wordCount / 150); // ~150 words/min speech
    const estDuration = estMinutes > 60 ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}min` : `${estMinutes} min`;
    const previewText = this.rawText.substring(0, 500);
    const hasMore = this.rawText.length > 500;

    this.progressArea.innerHTML = `
      <div class="preview-card fade-in">
        <div class="preview-stats">
          <span>📄 ${this._esc(this.file.name)}</span>
          <span class="stat">${wordCount.toLocaleString('pt-BR')} palavras</span>
          <span class="stat">~${estDuration} de áudio</span>
          <span class="stat">${this.chunks.length} segmentos</span>
        </div>
        <div class="preview-text" id="preview-text">${this._esc(previewText)}${hasMore ? '...' : ''}</div>
        ${hasMore ? `<button class="btn-secondary btn-sm" id="btn-preview-toggle">${strings.preview.showMore}</button>` : ''}
        <div class="preview-actions">
          <button class="btn-primary" id="btn-continue">${strings.actions.generate}</button>
          <button class="btn-secondary" id="btn-back-upload">${strings.actions.newFile}</button>
        </div>
      </div>
    `;

    let expanded = false;
    const toggleBtn = this.progressArea.querySelector('#btn-preview-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        expanded = !expanded;
        const el = this.progressArea.querySelector('#preview-text');
        el.textContent = expanded ? this.rawText : previewText + (hasMore ? '...' : '');
        toggleBtn.textContent = expanded ? strings.preview.showLess : strings.preview.showMore;
        el.classList.toggle('preview-expanded', expanded);
      });
    }

    this.progressArea.querySelector('#btn-continue').addEventListener('click', () => {
      this._setState(STATES.MODE_SELECT);
    });
    this.progressArea.querySelector('#btn-back-upload').addEventListener('click', () => this._reset());
  }

  // ── Mode Select with Voice Selector + Preview ──

  _renderModeSelect() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = 'none';
    this.progressArea.style.display = '';

    const isDark = document.documentElement.classList.contains('dark');

    this.progressArea.innerHTML = `
      <div class="mode-select fade-in">
        <h3>${strings.mode.select}</h3>
        <div class="mode-buttons">
          <button class="mode-btn" data-mode="fast">
            <strong>${strings.mode.fast}</strong>
            <span>${strings.mode.fastDesc}</span>
          </button>
          <button class="mode-btn" data-mode="quality">
            <strong>${strings.mode.quality}</strong>
            <span>${strings.mode.qualityDesc}</span>
          </button>
        </div>

        <div class="voice-select" id="voice-select-section">
          <label class="voice-label">${strings.voice.select}:</label>
          <div class="voice-options">
            ${VOICE_OPTIONS.map((v, i) => `
              <label class="voice-option ${v.id === this.selectedVoice ? 'selected' : ''}">
                <input type="radio" name="voice" value="${v.id}" ${v.id === this.selectedVoice ? 'checked' : ''} />
                <span>${v.label}</span>
                <button class="btn-preview-voice" data-voice="${v.id}" title="${strings.voice.preview}">🔊</button>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="mode-bottom-actions">
          <button class="btn-secondary" id="btn-back-upload">${strings.actions.newFile}</button>
          <button class="btn-secondary" id="btn-dark-toggle">${isDark ? strings.darkMode.lightLabel : strings.darkMode.label}</button>
        </div>
      </div>
    `;

    this.progressArea.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        this._startGeneration();
      });
    });

    this.progressArea.querySelectorAll('input[name="voice"]').forEach((input) => {
      input.addEventListener('change', () => {
        this.selectedVoice = input.value;
        this.progressArea.querySelectorAll('.voice-option').forEach((el) => el.classList.remove('selected'));
        input.closest('.voice-option').classList.add('selected');
      });
    });

    this.progressArea.querySelectorAll('.btn-preview-voice').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._previewVoice(btn.dataset.voice);
      });
    });

    this.progressArea.querySelector('#btn-back-upload').addEventListener('click', () => this._reset());
    this.progressArea.querySelector('#btn-dark-toggle').addEventListener('click', () => this._toggleDarkMode());
  }

  async _previewVoice(voiceId) {
    if (this._previewAudio) { this._previewAudio.pause(); this._previewAudio = null; }

    const tts = await import('@diffusionstudio/vits-web');
    const isCached = (await tts.stored()).includes(voiceId);
    if (!isCached) {
      showToast('Baixando modelo para amostra...', 'info');
      await tts.download(voiceId);
    }
    const wav = await tts.predict({ text: SAMPLE_TEXT, voiceId });
    this._previewAudio = new Audio(URL.createObjectURL(wav));
    this._previewAudio.play();
    showToast(`Reproduzindo amostra: ${voiceId}`, 'info');
  }

  // ── Generation with ETA ──

  async _startGeneration() {
    this._setState(STATES.GENERATING);
    this._canceled = false;
    this._genStartTime = Date.now();

    try {
      if (this.mode === 'fast') await this._generateFast();
      else await this._generateQuality();

      if (!this._canceled) this._setState(STATES.COMPLETE);
    } catch (err) {
      if (!this._canceled) this._showError(err.message);
    }
  }

  async _generateFast() {
    this.browserTTS = new BrowserTTS();
    await this.browserTTS.init();
    if (this.browserTTS.availableVoices.length === 0) throw new Error(strings.errors.noVoice);
    showToast(strings.toast.generationStarted, 'info');
    await this.browserTTS.speak(this.chunks, 0, (current, total) => {
      if (this._canceled) throw new Error('canceled');
      this._showGenerationProgress(current, total);
    });
  }

  async _generateQuality() {
    this.worker = new TTSWorkerManager();
    await this.worker.init();

    this._showGenerationProgress(0, this.chunks.length, true);
    await this.worker.downloadVoice(this.selectedVoice, (progress) => {
      this._showSkeletonProgress(
        strings.voice.downloadProgress.replace('{percent}', Math.round(progress * 100)),
        progress,
      );
    });
    showToast(strings.toast.voiceDownloaded, 'success');

    this.audioSegments = await this.worker.generateAll(this.chunks, (current, total) => {
      if (this._canceled) throw new Error('canceled');
      this._showGenerationProgress(current, total);
    });
  }

  _showGenerationProgress(current, total, downloading = false) {
    const pct = total > 0 ? current / total : 0;
    const elapsed = (Date.now() - this._genStartTime) / 1000;
    const rate = current > 0 ? elapsed / current : 0;
    const remaining = Math.max(0, Math.round(rate * (total - current)));
    const etaStr = remaining > 60 ? `${Math.floor(remaining / 60)}min ${remaining % 60}s` : `${remaining}s`;

    const msg = downloading
      ? strings.voice.downloading
      : strings.progress.generating.replace('{current}', current).replace('{total}', total);

    this._showSkeletonProgress(msg, pct, remaining > 0 ? strings.progress.eta.replace('{eta}', etaStr) : '');
  }

  // ── Playback ──

  async _startPlayback() {
    this._setState(STATES.PLAYING);

    if (!this.player.queue.length) {
      const wavBlobs = this.audioSegments.map((seg) => {
        const audio = seg.audio || seg;
        const processed = trimSilence(normalizeAudio(audio), 22050);
        return encodeWav(processed, 22050);
      });
      await this.player.loadSegments(wavBlobs);
    }

    this.player.play();

    this.player.onSegmentChange(() => this._render());
    this.player.onProgress(() => this._render());
    this.player.onComplete(() => {
      this._setState(STATES.COMPLETE);
      showToast(strings.toast.generationComplete, 'success');
    });
  }

  _pausePlayback() { this.player.pause(); this.state = STATES.PAUSED; this._render(); }
  _resumePlayback() { this.player.resume(); this.state = STATES.PLAYING; this._render(); }
  _stopPlayback() { this.player.stop(); this._setState(STATES.COMPLETE); }

  // ── Download with quality selector ──

  async _downloadMp3() {
    showToast(strings.toast.downloadStarted, 'info');
    const { audio, sampleRate } = await concatenateAudio(this.audioSegments);
    const normalized = normalizeAudio(audio);
    const blob = await encodeMp3(normalized, sampleRate, this.mp3Bitrate);
    downloadBlob(blob, this.file.name.replace(/\.[^.]+$/, '') + '.mp3');
  }

  async _downloadWav() {
    showToast(strings.toast.downloadStarted, 'info');
    const { audio, sampleRate } = await concatenateAudio(this.audioSegments);
    const normalized = normalizeAudio(audio);
    const blob = encodeWav(normalized, sampleRate);
    downloadBlob(blob, this.file.name.replace(/\.[^.]+$/, '') + '.wav');
  }

  // ── Rendering ──

  _render() {
    switch (this.state) {
      case STATES.PREVIEW: this._renderPreview(); break;
      case STATES.MODE_SELECT: this._renderModeSelect(); break;
      case STATES.PLAYING: case STATES.PAUSED: this._renderPlayer(); break;
      case STATES.COMPLETE: this._renderComplete(); break;
    }
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _renderPlayer() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = '';
    this.progressArea.style.display = 'none';

    const isPlaying = this.state === STATES.PLAYING;
    const elapsed = this.player.elapsedDuration;
    const total = this.player.totalDuration;
    const overallPct = total > 0 ? (elapsed / total * 100) : 0;
    const currentSpeed = this.player.speed;
    const isDark = document.documentElement.classList.contains('dark');

    this.playerArea.innerHTML = `
      <div class="player fade-in">
        <div class="player-file-row">
          <span class="player-file">${this._esc(this.file.name)}</span>
          <button class="btn-icon" id="btn-dark-player" title="${isDark ? strings.darkMode.lightLabel : strings.darkMode.label}">
            ${isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div class="player-segment-row">
          <span>${strings.player.segmentOf.replace('{current}', this.player.currentSegmentIndex + 1).replace('{total}', this.player.totalSegments)}</span>
        </div>

        <div class="seek-bar-container" id="seek-bar">
          <div class="seek-bar-fill" style="width:${overallPct}%"></div>
        </div>
        <div class="time-row">
          <span>${this._formatTime(elapsed)}</span>
          <span>${this._formatTime(total)}</span>
        </div>

        <div class="player-controls">
          <button class="btn-control" id="btn-skip-back" title="-10s">⏪</button>
          <button class="btn-primary btn-lg" id="btn-play-pause">${isPlaying ? '⏸' : '▶'}</button>
          <button class="btn-control" id="btn-skip-forward" title="+10s">⏩</button>
          <button class="btn-control" id="btn-stop" title="${strings.actions.stop}">⏹</button>
        </div>

        <div class="speed-presets">
          ${SPEED_PRESETS.map(s => `<button class="btn-speed ${s === currentSpeed ? 'active' : ''}" data-speed="${s}">${s}x</button>`).join('')}
        </div>

        <div class="segment-list" id="segment-list">
          ${this._renderSegmentList()}
        </div>

        <div class="keyboard-hint">${strings.keyboard.space}: play/pause · ←→: ±10s · ↑↓: velocidade · M: escuro</div>
      </div>
    `;

    this.playerArea.querySelector('#btn-play-pause').addEventListener('click', () => {
      if (isPlaying) this._pausePlayback(); else this._resumePlayback();
    });
    this.playerArea.querySelector('#btn-stop').addEventListener('click', () => this._stopPlayback());
    this.playerArea.querySelector('#btn-skip-back').addEventListener('click', () => this.player.skip(-10));
    this.playerArea.querySelector('#btn-skip-forward').addEventListener('click', () => this.player.skip(10));
    this.playerArea.querySelector('#seek-bar').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;
      this.player.seekToFraction(fraction);
    });

    this.playerArea.querySelectorAll('.btn-speed').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.player.speed = parseFloat(btn.dataset.speed);
        this._render();
      });
    });

    this.playerArea.querySelectorAll('.segment-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.player.seekTo(parseInt(item.dataset.index));
      });
    });

    this.playerArea.querySelector('#btn-dark-player').addEventListener('click', () => this._toggleDarkMode());
  }

  _renderSegmentList() {
    const maxShow = 20;
    const items = [];
    const total = this.player.totalSegments;
    const current = this.player.currentSegmentIndex;

    for (let i = 0; i < Math.min(total, maxShow); i++) {
      const isCurrent = i === current;
      const isPlayed = i < current;
      const cls = isCurrent ? 'current' : isPlayed ? 'played' : '';
      const icon = isCurrent ? '🔊' : isPlayed ? '✓' : '○';
      items.push(`<div class="segment-item ${cls}" data-index="${i}">${icon} Segmento ${i + 1}</div>`);
    }
    if (total > maxShow) items.push(`<div class="segment-item more">... e mais ${total - maxShow} segmentos</div>`);
    return items.join('');
  }

  _renderComplete() {
    this.uploadArea.style.display = 'none';
    this.playerArea.style.display = '';
    this.progressArea.style.display = '';

    const hasAudio = this.audioSegments.length > 0;
    const isFastMode = this.mode === 'fast';
    const isDark = document.documentElement.classList.contains('dark');

    this.playerArea.innerHTML = `
      <div class="player complete fade-in">
        <p class="complete-title">✅ ${strings.progress.complete}</p>
        ${hasAudio ? `
          <div class="player-controls">
            <button id="btn-play" class="btn-primary btn-lg">${strings.actions.play}</button>
          </div>
          <div class="download-section">
            <h4>${strings.quality.label}:</h4>
            <div class="bitrate-options">
              ${MP3_BITRATES.map(b => `<button class="btn-bitrate ${b === this.mp3Bitrate ? 'active' : ''}" data-bitrate="${b}">${b} kbps</button>`).join('')}
            </div>
            <div class="download-buttons">
              <button id="btn-download-mp3" class="btn-secondary">${strings.actions.download}</button>
              <button id="btn-download-wav" class="btn-secondary">${strings.actions.downloadWav}</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (hasAudio) {
      this.playerArea.querySelector('#btn-play').addEventListener('click', () => this._startPlayback());
      this.playerArea.querySelector('#btn-download-mp3').addEventListener('click', () => this._downloadMp3());
      this.playerArea.querySelector('#btn-download-wav').addEventListener('click', () => this._downloadWav());

      this.playerArea.querySelectorAll('.btn-bitrate').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.mp3Bitrate = parseInt(btn.dataset.bitrate);
          this.playerArea.querySelectorAll('.btn-bitrate').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    this.progressArea.innerHTML = `
      <div class="complete-actions fade-in">
        <button class="btn-secondary" id="btn-new-file">${strings.actions.newFile}</button>
        <button class="btn-secondary" id="btn-dark-toggle">${isDark ? strings.darkMode.lightLabel : strings.darkMode.label}</button>
      </div>
    `;
    this.progressArea.querySelector('#btn-new-file').addEventListener('click', () => this._reset());
    this.progressArea.querySelector('#btn-dark-toggle').addEventListener('click', () => this._toggleDarkMode());
  }

  // ── Helpers ──

  _showSkeletonProgress(message, progress, etaText = '') {
    this.progressArea.style.display = '';
    const pct = progress ? Math.round(progress * 100) : '';
    const bar = progress !== undefined ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>` : '';
    const eta = etaText ? `<p class="progress-eta">${etaText}</p>` : '';

    this.progressArea.innerHTML = `
      <div class="progress fade-in">
        <p class="progress-text">${this._esc(message)}${pct ? ` (${pct}%)` : ''}</p>
        ${bar}${eta}
        ${this.state === STATES.GENERATING ? `<button class="btn-secondary btn-sm" id="btn-cancel">${strings.actions.cancel}</button>` : ''}
      </div>
    `;

    const cancelBtn = this.progressArea.querySelector('#btn-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this._canceled = true;
        if (this.browserTTS) this.browserTTS.cancel();
        showToast(strings.progress.canceled, 'info');
        this._reset();
      });
    }
  }

  _showError(message) {
    this._setState(STATES.ERROR);
    this.progressArea.style.display = '';
    this.progressArea.innerHTML = `
      <div class="error fade-in">
        <p>❌ ${this._esc(message)}</p>
        <button class="btn-secondary" id="btn-retry">${strings.actions.newFile}</button>
      </div>
    `;
    showToast(message, 'error', 5000);
    this.progressArea.querySelector('#btn-retry').addEventListener('click', () => this._reset());
  }

  _reset() {
    if (this._previewAudio) { this._previewAudio.pause(); this._previewAudio = null; }
    if (this.browserTTS) this.browserTTS.cancel();
    if (this.player) this.player.stop();
    if (this.worker) this.worker.terminate();
    this.file = null; this.format = null; this.rawText = '';
    this.segments = []; this.chunks = []; this.audioSegments = [];
    this.mode = null; this.browserTTS = null; this.worker = null;
    this._setState(STATES.IDLE);
    this._showUpload();
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
}
