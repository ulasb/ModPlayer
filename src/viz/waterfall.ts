import { Canvas2DVisualizer } from "./types";

/** Scrolling spectrogram waterfall — newest audio at the top. */
export class Waterfall extends Canvas2DVisualizer {
  readonly name = "WATERFALL";
  private row: ImageData | null = null;

  protected onResize() {
    this.row = null;
    this.ctx.fillStyle = "#020308";
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  render() {
    const { ctx, w, h, engine } = this;
    const ROW_H = 2;

    // scroll everything down
    ctx.drawImage(this.canvas, 0, ROW_H);

    if (!this.row || this.row.width !== w) this.row = ctx.createImageData(w, ROW_H);
    const data = this.row.data;

    for (let x = 0; x < w; x++) {
      const bin = Math.floor(Math.pow(x / w, 2) * engine.bins * 0.85);
      const v = (engine.freq[bin] ?? 0) / 255;
      // deep blue -> cyan -> yellow -> white heat ramp
      const r = Math.min(255, Math.max(0, (v - 0.45) * 560));
      const g = Math.min(255, Math.max(0, (v - 0.18) * 420));
      const b = Math.min(255, v < 0.5 ? 40 + v * 400 : 240 - (v - 0.5) * 220);
      const a = 255;
      for (let ry = 0; ry < ROW_H; ry++) {
        const o = (ry * w + x) * 4;
        data[o] = r * v + 4;
        data[o + 1] = g;
        data[o + 2] = b * (0.25 + v * 0.75);
        data[o + 3] = a;
      }
    }
    ctx.putImageData(this.row, 0, 0);
  }
}
