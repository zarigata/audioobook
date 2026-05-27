// AudioEncoder — MP3 (lamejs) and WAV encoding for audio export
// Handles both Float32Array PCM and WAV Blob inputs

/**
 * Encode Float32 PCM to WAV Blob
 */
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

/**
 * Encode Float32 PCM to MP3 Blob via lamejs
 */
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

/**
 * Decode a WAV Blob into Float32Array PCM
 */
export async function decodeWavBlob(wavBlob) {
  const arrayBuffer = await wavBlob.arrayBuffer();
  const dataView = new DataView(arrayBuffer);

  // Read sample rate from WAV header (bytes 24-27)
  const sampleRate = dataView.getUint32(24, true);

  // Find the "data" chunk
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

/**
 * Concatenate multiple audio inputs (WAV Blobs or Float32Arrays) into one Float32Array
 */
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
