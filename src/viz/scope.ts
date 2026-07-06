import { Canvas2DVisualizer } from "./types";

/** Phosphor-green oscilloscope with zero-crossing trigger and afterglow. */
export class Oscilloscope extends Canvas2DVisualizer {
  readonly name = "SCOPE";

  render() {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(2,8,4,0.28)"; // afterglow fade
    ctx.fillRect(0, 0, w, h);

    // graticule
    ctx.strokeStyle = "rgba(70,255,140,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const x = (w / 8) * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let i = 1; i < 6; i++) {
      const y = (h / 6) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const wave = engine.wave;
    const window = Math.min(1200, wave.length - 4);
    // Trigger on a rising zero-crossing for a stable trace
    let start = 0;
    for (let i = 1; i < wave.length - window; i++) {
      if (wave[i - 1] < 128 && wave[i] >= 128) {
        start = i;
        break;
      }
    }

    const amp = h * 0.38;
    const trace = (lineWidth: number, alpha: number) => {
      ctx.strokeStyle = `rgba(80,255,150,${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < window; i++) {
        const x = (i / window) * w;
        const y = h / 2 + ((wave[start + i] - 128) / 128) * amp;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    trace(9, 0.10); // wide glow pass
    trace(4.5, 0.22);
    trace(1.8, 0.95); // bright core
  }
}
