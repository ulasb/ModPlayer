import { Canvas2DVisualizer } from "./types";

/** Stereo X/Y phase scope — left channel drives X, right drives Y. */
export class Lissajous extends Canvas2DVisualizer {
  readonly name = "PHASE XY";

  render(t: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(2,6,8,0.16)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.42;

    // axes
    ctx.strokeStyle = "rgba(80,220,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - scale, cy - scale);
    ctx.lineTo(cx + scale, cy + scale);
    ctx.moveTo(cx - scale, cy + scale);
    ctx.lineTo(cx + scale, cy - scale);
    ctx.stroke();

    const L = engine.waveL;
    const R = engine.waveR;
    const n = Math.min(L.length, R.length);
    const hue = 175 + Math.sin(t * 0.0004) * 30;

    // rotate 45° so a mono signal draws a vertical line (classic goniometer)
    const c = Math.SQRT1_2;
    const trace = (lineWidth: number, alpha: number) => {
      ctx.strokeStyle = `hsla(${hue} 100% 65% / ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = cx + (L[i] - R[i]) * c * scale;
        const y = cy - (L[i] + R[i]) * c * scale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    trace(7, 0.06);
    trace(1.4, 0.55);
  }
}
