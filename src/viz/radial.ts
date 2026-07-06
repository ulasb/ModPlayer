import { Canvas2DVisualizer } from "./types";

/** Rotating circular spectrum — bars radiate from a beat-pulsing core. */
export class RadialSpectrum extends Canvas2DVisualizer {
  readonly name = "RADIAL";

  render(t: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(5,4,10,0.32)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) * (0.18 + engine.beatPulse * 0.035);
    const maxLen = Math.min(w, h) * 0.30;
    const N = 108;
    const rot = t * 0.00012 + engine.level * 0.4;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < N; i++) {
      const bin = Math.floor(Math.pow(i / N, 1.5) * engine.bins * 0.7);
      const v = Math.pow((engine.freq[bin] ?? 0) / 255, 1.3);
      const a = (i / N) * Math.PI * 2 + rot;
      const len = v * maxLen + 2;
      const hue = (i / N) * 300 + t * 0.02;
      ctx.strokeStyle = `hsla(${hue} 95% ${45 + v * 25}% / ${0.35 + v * 0.65})`;
      ctx.lineWidth = ((Math.PI * 2 * base) / N) * 0.55;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * base, Math.sin(a) * base);
      ctx.lineTo(Math.cos(a) * (base + len), Math.sin(a) * (base + len));
      ctx.stroke();
    }

    // waveform ring inside the bars
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${t * 0.02 + 180} 100% 70% / 0.8)`;
    ctx.beginPath();
    const M = 180;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2 + rot;
      const s = (engine.wave[Math.floor((i / M) * (engine.wave.length - 1))] - 128) / 128;
      const r = base * 0.72 + s * base * 0.28;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // core glow
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, base * 0.6);
    g.addColorStop(0, `hsla(${t * 0.02 + 40} 100% 65% / ${0.25 + engine.beatPulse * 0.5})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, base * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }
}
