import { Canvas2DVisualizer } from "./types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
}

/** Audio-reactive particle fountain: flow follows loudness, beats explode. */
export class ParticleFountain extends Canvas2DVisualizer {
  readonly name = "PARTICLES";
  private particles: Particle[] = [];

  render(t: number, dt: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(3,3,8,0.22)";
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w, h) / 800;
    const baseHue = (t * 0.02) % 360;

    // continuous fountain from the bottom, rate follows loudness
    const spawnCount = Math.floor(engine.level * 14) + (engine.level > 0.01 ? 1 : 0);
    for (let i = 0; i < spawnCount; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      this.particles.push({
        x: w / 2 + spread * w * 0.05,
        y: h * 0.98,
        vx: spread * (2 + engine.mid * 8) * scale,
        vy: -(7 + Math.random() * 6 + engine.level * 22) * scale,
        life: 0,
        maxLife: 60 + Math.random() * 60,
        hue: baseHue + Math.random() * 60,
        size: (1.5 + Math.random() * 2.5 + engine.treble * 4) * scale,
      });
    }

    // beat: radial burst from the center
    if (engine.beat) {
      const n = 36 + Math.floor(engine.bass * 60);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const sp = (4 + Math.random() * 7 + engine.bass * 12) * scale;
        this.particles.push({
          x: w / 2,
          y: h / 2,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          maxLife: 40 + Math.random() * 40,
          hue: baseHue + 180 + Math.random() * 40,
          size: (2 + Math.random() * 3) * scale,
        });
      }
    }

    const grav = 0.14 * scale * (dt / 16.7);
    ctx.globalCompositeOperation = "lighter";
    this.particles = this.particles.filter((p) => {
      p.life += dt / 16.7;
      if (p.life > p.maxLife || p.y > h + 20) return false;
      p.vy += grav;
      p.x += p.vx * (dt / 16.7);
      p.y += p.vy * (dt / 16.7);
      const fade = 1 - p.life / p.maxLife;
      ctx.fillStyle = `hsla(${p.hue} 100% ${55 + fade * 15}% / ${fade * 0.9})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + fade * 0.7), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    if (this.particles.length > 2600) this.particles.splice(0, this.particles.length - 2600);
    ctx.globalCompositeOperation = "source-over";
  }
}
