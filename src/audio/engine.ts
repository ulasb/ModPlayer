/**
 * Shared WebAudio graph and per-frame analysis data.
 *
 * Both players (tracker + MIDI) route into `master`. From there:
 *   master ──► analyser ──► destination        (mono-ish combined analysis)
 *   master ──► splitter ──► analyserL/R        (stereo analysis, not audible)
 *
 * `update()` is called once per animation frame by the viz manager; all
 * visualizers then read the same arrays — no visualizer touches WebAudio.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly analyser: AnalyserNode;
  private readonly analyserL: AnalyserNode;
  private readonly analyserR: AnalyserNode;

  readonly bins: number;
  readonly freq: Uint8Array<ArrayBuffer>; // frequency magnitudes 0..255
  readonly wave: Uint8Array<ArrayBuffer>; // time-domain 0..255, centered at 128
  readonly waveL: Float32Array<ArrayBuffer>; // stereo time-domain -1..1
  readonly waveR: Float32Array<ArrayBuffer>;

  /** Smoothed overall loudness 0..1 */
  level = 0;
  /** Bass / mid / treble band energies 0..1 */
  bass = 0;
  mid = 0;
  treble = 0;
  /** True only on the frame a beat is detected */
  beat = false;
  /** Pulse that jumps to 1 on beat and decays — handy for visual kicks */
  beatPulse = 0;

  private energyHistory: number[] = [];
  private lastBeatAt = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const splitter = this.ctx.createChannelSplitter(2);
    this.master.connect(splitter);
    this.analyserL = this.ctx.createAnalyser();
    this.analyserR = this.ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserR.fftSize = 1024;
    splitter.connect(this.analyserL, 0);
    splitter.connect(this.analyserR, 1);

    this.bins = this.analyser.frequencyBinCount;
    this.freq = new Uint8Array(this.bins);
    this.wave = new Uint8Array(this.analyser.fftSize);
    this.waveL = new Float32Array(this.analyserL.fftSize);
    this.waveR = new Float32Array(this.analyserR.fftSize);
  }

  setVolume(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  private bandAverage(fromHz: number, toHz: number): number {
    const hzPerBin = this.ctx.sampleRate / this.analyser.fftSize;
    const a = Math.max(0, Math.floor(fromHz / hzPerBin));
    const b = Math.min(this.bins - 1, Math.ceil(toHz / hzPerBin));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += this.freq[i];
    return sum / ((b - a + 1) * 255);
  }

  update(now: number) {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);
    this.analyserL.getFloatTimeDomainData(this.waveL);
    this.analyserR.getFloatTimeDomainData(this.waveR);

    this.bass = this.bandAverage(20, 250);
    this.mid = this.bandAverage(250, 2000);
    this.treble = this.bandAverage(2000, 12000);

    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) {
      const v = (this.wave[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.wave.length);
    this.level += (rms - this.level) * 0.2;

    // Beat detection: instantaneous bass energy vs. ~0.7 s rolling average
    const energy = this.bass;
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 43) this.energyHistory.shift();
    const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

    this.beat = false;
    if (energy > 0.08 && energy > avg * 1.35 && now - this.lastBeatAt > 180) {
      this.beat = true;
      this.beatPulse = 1;
      this.lastBeatAt = now;
    }
    this.beatPulse *= 0.94;
  }
}
