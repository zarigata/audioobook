// AudioEncoder — MP3 (lamejs) and WAV encoding for audio export

const SAMPLE_RATE = 22050; // Piper default

/**
 * Encode Float32 PCM to WAV Blob
 */
export function encodeWav(audioData, sampleRate = SAMPLE_RATE) {
  const numSamples = audioData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Float32 → Int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Encode Float32 PCM to MP3 Blob via lamejs
 */
export async function encodeMp3(audioData, sampleRate = SAMPLE_RATE, bitrate = 128) {
  const { default: lamejs } = await import('@breezystack/lamejs');

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
  const int16 = float32ToInt16(audioData);

  const blockSize = 1152;
  const mp3Chunks = [];

  for (let i = 0; i < int16.length; i += blockSize) {
    const chunk = int16.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(mp3buf);
    }
  }

  const end = mp3encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(end);
  }

  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}

/**
 * Concatenate multiple Float32Arrays into one
 */
export function concatenateAudio(chunks) {
  let totalLength = 0;
  for (const chunk of chunks) {
    const data = chunk.audio || chunk;
    totalLength += data.length;
  }

  const result = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    const data = chunk.audio || chunk;
    result.set(data, offset);
    offset += data.length;
  }

  return result;
}

/**
 * Trigger browser download of a blob
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function float32ToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
