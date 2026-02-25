/**
 * AudioWorklet processor: Float32 → Int16 PCM, 2048-sample buffering at 16kHz.
 * Sends binary Int16 PCM chunks to the main thread via MessagePort.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(2048);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0]; // mono
    let i = 0;

    while (i < channel.length) {
      const remaining = this._buffer.length - this._offset;
      const toCopy = Math.min(remaining, channel.length - i);
      this._buffer.set(channel.subarray(i, i + toCopy), this._offset);
      this._offset += toCopy;
      i += toCopy;

      if (this._offset >= this._buffer.length) {
        // Convert Float32 → Int16
        const int16 = new Int16Array(this._buffer.length);
        for (let j = 0; j < this._buffer.length; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]));
          int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
        this._buffer = new Float32Array(2048);
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
