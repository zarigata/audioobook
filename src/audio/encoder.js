// AudioEncoder — MP3 (lamejs) and WAV encoding, normalization, silence trimming

export function encodeWav(audioData, sampleRate = 22050) {
  const numSamples = audioData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function encodeMp3(audioData, sampleRate = 22050, bitrate = 128) {
  const { default: lamejs } = await import('@breezystack/lamejs');

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
  const int16 = float32ToInt16(audioData);
  const blockSize = 1152;
  const mp3Chunks = [];

  for (let i = 0; i < int16.length; i += blockSize) {
    const chunk = int16.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Chunks.push(end);

  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}

export async function decodeWavBlob(wavBlob) {
  const arrayBuffer = await wavBlob.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  const sampleRate = dataView.getUint32(24, true);

  let dataOffset = 12;
  let dataLength = 0;
  while (dataOffset < arrayBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(dataOffset),
      dataView.getUint8(dataOffset + 1),
      dataView.getUint8(dataOffset + 2),
      dataView.getUint8(dataOffset + 3),
    );
    const chunkSize = dataView.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      dataOffset += 8;
      dataLength = chunkSize;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataLength === 0) {
    dataOffset = 44;
    dataLength = arrayBuffer.byteLength - 44;
  }

  const numSamples = dataLength / 2;
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    float32[i] = dataView.getInt16(dataOffset + i * 2, true) / 0x8000;
  }

  return { audio: float32, sampleRate };
}

export async function concatenateAudio(chunks) {
  const decoded = [];

  for (const chunk of chunks) {
    if (chunk instanceof Blob) {
      decoded.push(await decodeWavBlob(chunk));
    } else if (chunk.audio instanceof Float32Array) {
      decoded.push(chunk);
    } else if (chunk instanceof Float32Array) {
      decoded.push({ audio: chunk, sampleRate: 22050 });
    }
  }

  let totalLength = 0;
  for (const d of decoded) totalLength += d.audio.length;

  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const d of decoded) {
    result.set(d.audio, offset);
    offset += d.audio.length;
  }

  const sampleRate = decoded.length > 0 ? decoded[0].sampleRate : 22050;
  return { audio: result, sampleRate };
}

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

/**
 * Normalize audio to a target peak level (default -1 dB).
 * Makes all segments the same volume.
 */
export function normalizeAudio(audioData, targetDb = -1) {
  let peak = 0;
  for (let i = 0; i < audioData.length; i++) {
    const abs = Math.abs(audioData[i]);
    if (abs > peak) peak = abs;
  }

  if (peak === 0) return audioData;

  const targetLinear = Math.pow(10, targetDb / 20);
  const gain = targetLinear / peak;

  const result = new Float32Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    result[i] = Math.max(-1, Math.min(1, audioData[i] * gain));
  }

  return result;
}

/**
 * Trim silence from audio — remove samples below threshold for longer than minSilenceMs.
 * Keeps minPaddingMs of silence at start and end of each segment.
 */
export function trimSilence(audioData, sampleRate = 22050, options = {}) {
  const {
    threshold = 0.01,
    minSilenceMs = 500,
    minPaddingMs = 150,
  } = options;

  const minSilenceSamples = Math.floor(sampleRate * minSilenceMs / 1000);
  const paddingSamples = Math.floor(sampleRate * minPaddingMs / 1000);

  // Find where audio starts and ends (above threshold)
  let start = 0;
  while (start < audioData.length && Math.abs(audioData[start]) < threshold) start++;

  let end = audioData.length - 1;
  while (end > start && Math.abs(audioData[end]) < threshold) end--;

  if (start >= end) return audioData;

  // Add padding
  start = Math.max(0, start - paddingSamples);
  end = Math.min(audioData.length - 1, end + paddingSamples);

  // Find internal silence runs longer than minSilenceMs and trim them to paddingSamples
  const result = [];
  let silenceStart = -1;
  let regionStart = start;

  for (let i = start; i <= end; i++) {
    const isSilent = Math.abs(audioData[i]) < threshold;

    if (isSilent && silenceStart === -1) {
      silenceStart = i;
    } else if (!isSilent && silenceStart !== -1) {
      const silenceLength = i - silenceStart;
      if (silenceLength > minSilenceSamples) {
        // Keep audio before silence
        if (silenceStart > regionStart) {
          result.push(audioData.slice(regionStart, silenceStart));
        }
        // Add shortened silence
        result.push(new Float32Array(Math.min(paddingSamples * 2, silenceLength)));
        regionStart = i;
      }
      silenceStart = -1;
    }
  }

  // Add remaining audio
  if (regionStart < end) {
    result.push(audioData.slice(regionStart, end + 1));
  }

  // Concatenate result pieces
  let totalLength = 0;
  for (const piece of result) totalLength += piece.length;

  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const piece of result) {
    output.set(piece, offset);
    offset += piece.length;
  }

  return output;
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
