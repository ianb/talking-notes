/**
 * AudioWorklet processor that captures mic input and outputs
 * PCM s16le at 16kHz mono in ~300ms chunks.
 *
 * Must be loaded via audioContext.audioWorklet.addModule().
 */

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 300;
const CHUNK_SAMPLES = (TARGET_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000; // 4800

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(CHUNK_SAMPLES);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const sourceData = input[0]; // mono channel
    const ratio = sampleRate / TARGET_SAMPLE_RATE;

    for (const [i, sourceDatum] of sourceData.entries()) {
      const targetIndex = i / ratio;
      const idx = Math.floor(targetIndex);
      if (idx >= 0 && this._offset + idx < this._buffer.length) {
        this._buffer[this._offset + idx] = sourceDatum;
      }
    }

    const produced = Math.floor(sourceData.length / ratio);
    this._offset += produced;

    if (this._offset >= CHUNK_SAMPLES) {
      const int16 = new Int16Array(CHUNK_SAMPLES);
      for (let i = 0; i < CHUNK_SAMPLES; i++) {
        const s = Math.max(-1, Math.min(1, this._buffer[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage({ type: "pcm", samples: int16.buffer }, [
        int16.buffer,
      ]);

      const overflow = this._offset - CHUNK_SAMPLES;
      this._buffer = new Float32Array(CHUNK_SAMPLES);
      this._offset = overflow > 0 ? overflow : 0;
    }

    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
