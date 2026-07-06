import { Canvas2DVisualizer } from "./types";

/** Synthwave horizon — spectrum mountains scroll out of a glowing sun. */
export class WaveGrid extends Canvas2DVisualizer {
  readonly name = "HORIZON";
  private history: Float32Array[] = [];
  private sinceRow = 0;

  private static readonly COLS = 72;
  private static readonly ROWS = 44;

  render(t: number, dt: number) {
    const { ctx, w, h, engine } = this;
    const COLS = WaveGrid.COLS;
    const ROWS = WaveGrid.ROWS;

    // capture a spectrum snapshot every ~55 ms (keep the timer remainder so
    // the sub-row interpolation below stays continuous across captures)
    this.sinceRow += dt;
    while (this.sinceRow >= 55) {
      this.sinceRow -= 55;
      const row = new Float32Array(COLS);
      for (let i = 0; i < COLS; i++) {
        // symmetric around center: bass in the middle, treble at the edges
        const centered = Math.abs(i - (COLS - 1) / 2) / ((COLS - 1) / 2);
        const bin = Math.floor(Math.pow(centered, 1.7) * engine.bins * 0.5);
        row[i] = Math.pow((engine.freq[bin] ?? 0) / 255, 1.4);
      }
      this.history.unshift(row); // newest first — spawns at the horizon
      if (this.history.length > ROWS) this.history.pop();
    }

    // sky
    const horizon = h * 0.42;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#050112");
    sky.addColorStop(1, "#2a0a3a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = "#050112";
    ctx.fillRect(0, horizon, w, h - horizon);

    // pulsing sun
    const sunR = Math.min(w, h) * (0.13 + engine.bass * 0.05 + engine.beatPulse * 0.02);
    const sun = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, sunR * 2.2);
    sun.addColorStop(0, "rgba(255,120,60,0.95)");
    sun.addColorStop(0.4, "rgba(255,50,120,0.5)");
    sun.addColorStop(1, "transparent");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(w / 2, horizon, sunR * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,170,90,0.9)";
    ctx.beginPath();
    ctx.arc(w / 2, horizon, sunR, Math.PI, 0);
    ctx.fill();

    // mountains: draw far rows first, fill under each line to occlude.
    // depth(j, scroll) = (ROWS - j - scroll) / ROWS is continuous when a
    // capture bumps every index by one and resets scroll to zero, so each
    // row glides smoothly from the horizon toward the viewer every frame.
    const zNear = 1;
    const zFar = 7;
    const scroll = this.sinceRow / 55; // sub-row interpolation for smooth motion
    for (let j = 0; j < this.history.length; j++) {
      const depth = (ROWS - j - scroll) / ROWS; // 0 near, 1 far
      const z = zNear + depth * (zFar - zNear);
      const y0 = horizon + (h - horizon) * 0.02 + ((h - horizon) * 1.05) / z;
      const amp = (h * 0.55) / z;
      const spread = (w * 2.6) / z;
      const row = this.history[j];

      ctx.beginPath();
      ctx.moveTo(w / 2 - spread / 2, y0);
      for (let i = 0; i < WaveGrid.COLS; i++) {
        const x = w / 2 + (i / (WaveGrid.COLS - 1) - 0.5) * spread;
        ctx.lineTo(x, y0 - row[i] * amp);
      }
      ctx.lineTo(w / 2 + spread / 2, y0);
      ctx.lineTo(w / 2 + spread / 2, h + 2);
      ctx.lineTo(w / 2 - spread / 2, h + 2);
      ctx.closePath();
      ctx.fillStyle = "#050112";
      ctx.fill();
      const nearness = 1 - depth;
      const hue = 285 - nearness * 100;
      // fade in over the first row-depth so new rows don't pop at the horizon
      const fadeIn = Math.min(1, nearness * ROWS);
      ctx.strokeStyle = `hsla(${hue} 100% ${45 + nearness * 65 * engine.level + nearness * 15}% / ${(0.25 + nearness * 0.75) * fadeIn})`;
      ctx.lineWidth = 1 + nearness * 1.6;
      ctx.stroke();
    }
  }
}
