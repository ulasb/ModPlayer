import { Canvas2DVisualizer } from "./types";

/** Mirrored kaleidoscope — one audio-painted wedge reflected 8 ways. */
export class Kaleidoscope extends Canvas2DVisualizer {
  readonly name = "KALEIDO";
  private wedge!: HTMLCanvasElement;
  private wctx!: CanvasRenderingContext2D;

  protected setup() {
    this.wedge = document.createElement("canvas");
    this.wctx = this.wedge.getContext("2d")!;
  }

  protected onResize() {
    if (!this.wedge) return;
    const R = Math.ceil(Math.hypot(this.w, this.h) / 2);
    this.wedge.width = R;
    this.wedge.height = R;
  }

  render(t: number) {
    const { ctx, w, h, engine, wctx, wedge } = this;
    const R = wedge.width;

    // paint the source wedge
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.fillStyle = "rgba(4,2,8,0.18)";
    wctx.fillRect(0, 0, R, R);
    wctx.globalCompositeOperation = "lighter";

    const bands = 22;
    for (let i = 0; i < bands; i++) {
      const bin = Math.floor(Math.pow(i / bands, 1.4) * engine.bins * 0.6);
      const v = (engine.freq[bin] ?? 0) / 255;
      if (v < 0.04) continue;
      const rad = (i / bands) * R * 0.95 + R * 0.05;
      const hue = (i * 16 + t * 0.03) % 360;
      const arc = 0.15 + v * 1.1 + engine.beatPulse * 0.3;
      const wobble = Math.sin(t * 0.001 + i * 1.7) * 0.5;
      wctx.strokeStyle = `hsla(${hue} 95% ${50 + v * 25}% / ${0.25 + v * 0.7})`;
      wctx.lineWidth = 2 + v * 7;
      wctx.beginPath();
      wctx.arc(0, 0, rad, wobble, wobble + arc);
      wctx.stroke();
    }

    // sparks riding the waveform
    for (let i = 0; i < 5; i++) {
      const s = engine.wave[(i * 199) % engine.wave.length] / 255;
      const rad = s * R * 0.9;
      const a = ((t * 0.0005 + i * 0.9) % (Math.PI / 4)) + 0.1;
      wctx.fillStyle = `hsla(${(t * 0.05 + i * 60) % 360} 100% 75% / 0.8)`;
      wctx.beginPath();
      wctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, 2 + engine.treble * 6, 0, Math.PI * 2);
      wctx.fill();
    }
    wctx.globalCompositeOperation = "source-over";

    // mirror the wedge around the center
    ctx.fillStyle = "#020104";
    ctx.fillRect(0, 0, w, h);
    const SEG = 8;
    const step = (Math.PI * 2) / SEG;
    const spin = t * 0.00008;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.globalCompositeOperation = "lighter";
    for (let s = 0; s < SEG; s++) {
      ctx.save();
      ctx.rotate(spin + s * step);
      if (s % 2 === 1) ctx.scale(1, -1);
      ctx.rotate(-step / 2);
      ctx.drawImage(wedge, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }
}
