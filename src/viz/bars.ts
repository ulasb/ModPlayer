import { Canvas2DVisualizer } from "./types";

/** Classic hi-fi LED segment spectrum analyzer with falling peak caps. */
export class SpectrumBars extends Canvas2DVisualizer {
  readonly name = "SPECTRUM";
  private peaks: number[] = [];

  render() {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, w, h);

    const bars = 48;
    const rows = 28;
    const gapX = Math.max(2, w * 0.004);
    const gapY = Math.max(2, h * 0.006);
    const padX = w * 0.05;
    const padTop = h * 0.08;
    const padBot = h * 0.1;
    const bw = (w - padX * 2 - gapX * (bars - 1)) / bars;
    const cellH = (h - padTop - padBot - gapY * (rows - 1)) / rows;

    if (this.peaks.length !== bars) this.peaks = new Array(bars).fill(0);

    for (let i = 0; i < bars; i++) {
      // Logarithmic-ish bin mapping so bass doesn't hog the display
      const lo = Math.floor(Math.pow(i / bars, 1.6) * engine.bins * 0.72);
      const hi = Math.floor(Math.pow((i + 1) / bars, 1.6) * engine.bins * 0.72);
      let v = 0;
      for (let k = lo; k <= Math.max(lo, hi); k++) v = Math.max(v, engine.freq[k] ?? 0);
      const level = Math.pow(v / 255, 1.15);

      this.peaks[i] = Math.max(this.peaks[i] - 0.008, level);

      const lit = Math.round(level * rows);
      const peakRow = Math.round(this.peaks[i] * rows);
      const x = padX + i * (bw + gapX);

      for (let r = 0; r < rows; r++) {
        const y = h - padBot - (r + 1) * cellH - r * gapY;
        const frac = r / rows;
        // green -> amber -> red as the column climbs
        const hue = frac < 0.6 ? 145 - frac * 120 : Math.max(0, 72 - (frac - 0.6) * 180);
        if (r < lit) {
          ctx.fillStyle = `hsl(${hue} 100% ${52 + frac * 8}%)`;
        } else if (r === peakRow && peakRow > 0) {
          ctx.fillStyle = "#fff6e0";
        } else {
          ctx.fillStyle = "rgba(120,160,150,0.07)";
        }
        ctx.fillRect(x, y, bw, cellH);
      }
    }
  }
}
