import { Canvas2DVisualizer } from "./types";

/** Layered polar waveform flower drifting through color space. */
export class Nebula extends Canvas2DVisualizer {
  readonly name = "NEBULA";

  render(t: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(3,2,6,0.09)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const r0 = Math.min(w, h) * (0.16 + engine.level * 0.10 + engine.beatPulse * 0.04);
    const baseHue = t * 0.012;
    const wave = engine.wave;
    const M = 256;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "lighter";

    for (let layer = 0; layer < 3; layer++) {
      const dir = layer % 2 === 0 ? 1 : -1;
      const rot = dir * t * (0.00012 + layer * 0.00007);
      const petals = 1 + layer; // layer 0 traces the wave, others fold it
      const hue = (baseHue + layer * 47) % 360;
      ctx.strokeStyle = `hsla(${hue} 90% 62% / ${0.5 - layer * 0.12})`;
      ctx.lineWidth = 2.2 - layer * 0.5;
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const a = (i / M) * Math.PI * 2;
        const wi = Math.floor(((i * petals) % M) / M * (wave.length - 1));
        const s = (wave[wi] - 128) / 128;
        const r = r0 * (1 + layer * 0.35) + s * r0 * (0.55 + engine.mid * 0.8);
        const x = Math.cos(a + rot) * r;
        const y = Math.sin(a + rot) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // core
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r0 * 0.8);
    g.addColorStop(0, `hsla(${(baseHue + 180) % 360} 100% 70% / ${0.12 + engine.bass * 0.35})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r0 * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }
}
