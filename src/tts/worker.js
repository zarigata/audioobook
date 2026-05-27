// Web Worker for off-thread TTS inference
// Receives text segments, generates audio via Piper, transfers back as ArrayBuffer

let ttsModule = null;
let voiceId = null;

self.onmessage = async (event) => {
  const { id, type } = event.data;

  try {
    switch (type) {
      case 'init': {
        const vits = await import('@diffusionstudio/vits-web');
        ttsModule = vits;
        self.postMessage({ id, type: 'ready' });
        break;
      }

      case 'download': {
        voiceId = event.data.voiceId;
        await ttsModule.download(voiceId, (progress) => {
          self.postMessage({
            id,
            type: 'download-progress',
            progress: progress.total > 0 ? progress.loaded / progress.total : 0,
          });
        });
        self.postMessage({ id, type: 'download-complete' });
        break;
      }

      case 'generate': {
        const { text } = event.data;
        const result = await ttsModule.predict({ text, voiceId });

        // Normalize to Float32Array
        let audio;
        if (result instanceof Float32Array) audio = result;
        else if (result instanceof ArrayBuffer) audio = new Float32Array(result);
        else if (result instanceof Blob) {
          const buf = await result.arrayBuffer();
          audio = new Float32Array(buf);
        } else if (result && result.getChannelData) {
          audio = result.getChannelData(0);
        }

        // Transfer (zero-copy) back to main thread
        const buffer = audio.buffer.slice(0);
        self.postMessage(
          { id, type: 'audio', audio: buffer, length: audio.length },
          { transfer: [buffer] },
        );
        break;
      }

      default:
        self.postMessage({ id, type: 'error', error: `Tipo desconhecido: ${type}` });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err.message });
  }
};
