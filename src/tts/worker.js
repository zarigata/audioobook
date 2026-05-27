// Web Worker for off-thread TTS inference
// predict() returns a WAV Blob — we decode it to Float32Array PCM for transfer

let ttsModule = null;
let voiceId = null;

self.onmessage = async (event) => {
  const { id, type } = event.data;

  try {
    switch (type) {
      case 'init': {
        ttsModule = await import('@diffusionstudio/vits-web');
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
        // predict() returns a WAV Blob
        const wavBlob = await ttsModule.predict({ text, voiceId });
        const arrayBuffer = await wavBlob.arrayBuffer();

        // Decode WAV: skip 44-byte header, convert Int16 PCM → Float32
        const pcm = wavPcmToFloat32(arrayBuffer);
        const transferBuffer = pcm.buffer.slice(0);

        self.postMessage(
          { id, type: 'audio', audio: transferBuffer, length: pcm.length },
          { transfer: [transferBuffer] },
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

/**
 * Parse a WAV ArrayBuffer: skip 44-byte header, convert Int16 → Float32
 */
function wavPcmToFloat32(wavBuffer) {
  const dataView = new DataView(wavBuffer);

  // Find the "data" chunk — not always at offset 36
  let dataOffset = 12;
  while (dataOffset < wavBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(dataOffset),
      dataView.getUint8(dataOffset + 1),
      dataView.getUint8(dataOffset + 2),
      dataView.getUint8(dataOffset + 3),
    );
    const chunkSize = dataView.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      dataOffset += 8;
      const numSamples = chunkSize / 2;
      const float32 = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        float32[i] = dataView.getInt16(dataOffset + i * 2, true) / 0x8000;
      }
      return float32;
    }
    dataOffset += 8 + chunkSize;
  }

  // Fallback: assume standard 44-byte header
  const numSamples = (wavBuffer.byteLength - 44) / 2;
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    float32[i] = dataView.getInt16(44 + i * 2, true) / 0x8000;
  }
  return float32;
}
