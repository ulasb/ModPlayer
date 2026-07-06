import { Canvas2DVisualizer } from "./types";

interface Star {
  x: number; // -1..1 camera plane
  y: number;
  z: number; // 1 far -> 0 near
  pz: number;
}

/** Warp-speed starfield; the music is the throttle. */
export class Starfield extends Canvas2DVisualizer {
  readonly name = "WARP";
  private stars: Star[] = [];

  protected setup() {
    this.stars = Array.from({ length: 420 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
      pz: 0,
    }));
    this.stars.forEach((s) => (s.pz = s.z));
  }

  render(t: number, dt: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = `rgba(2,2,10,${0.35 - engine.beatPulse * 0.15})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const f = Math.min(w, h) * 0.5;
    const speed = (0.0004 + engine.level * 0.004 + engine.beatPulse * 0.003) * dt;
    const hueBase = (t * 0.01) % 360;

    ctx.lineCap = "round";
    for (const s of this.stars) {
      s.pz = s.z;
      s.z -= speed * (0.3 + s.z);
      if (s.z <= 0.02) {
        s.x = Math.random() * 2 - 1;
        s.y = Math.random() * 2 - 1;
        s.z = 1;
        s.pz = 1;
        continue;
      }
      const sx = cx + (s.x / s.z) * f;
      const sy = cy + (s.y / s.z) * f;
      const px = cx + (s.x / s.pz) * f;
      const py = cy + (s.y / s.pz) * f;
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
        s.z = 1;
        s.pz = 1;
        continue;
      }
      const near = 1 - s.z;
      const hue = (hueBase + near * 60 + engine.treble * 120) % 360;
      ctx.strokeStyle = `hsla(${hue} ${30 + engine.level * 70}% ${60 + near * 35}% / ${0.25 + near * 0.75})`;
      ctx.lineWidth = 0.5 + near * 2.6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }
}
