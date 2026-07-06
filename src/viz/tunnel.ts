import { Canvas2DVisualizer } from "./types";

interface Ring {
  z: number;
  hue: number;
  bright: boolean;
  shape: number[]; // per-vertex radius modulation captured at spawn
}

/** Fly through rings whose shapes are stamped from the live spectrum. */
export class Tunnel extends Canvas2DVisualizer {
  readonly name = "TUNNEL";
  private rings: Ring[] = [];
  private sinceSpawn = 0;

  private spawnRing(bright: boolean) {
    const { engine } = this;
    const V = 40;
    const shape: number[] = [];
    for (let i = 0; i < V; i++) {
      const bin = Math.floor((i / V) * engine.bins * 0.4);
      shape.push(((engine.freq[bin] ?? 0) / 255) * 0.35);
    }
    this.rings.push({
      z: 1,
      hue: (performance.now() * 0.02) % 360,
      bright,
      shape,
    });
  }

  render(t: number, dt: number) {
    const { ctx, w, h, engine } = this;
    ctx.fillStyle = "rgba(2,2,6,0.4)";
    ctx.fillRect(0, 0, w, h);

    this.sinceSpawn += dt;
    if (this.sinceSpawn > 70) {
      this.sinceSpawn = 0;
      this.spawnRing(false);
    }
    if (engine.beat) this.spawnRing(true);

    const cx = w / 2 + Math.sin(t * 0.0006) * w * 0.08;
    const cy = h / 2 + Math.cos(t * 0.0008) * h * 0.08;
    const scale = Math.min(w, h) * 0.32;
    const speed = dt * 0.001 * (0.5 + engine.level * 2.5);
    const twist = t * 0.0004;

    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";

    this.rings = this.rings.filter((ring) => {
      ring.z -= speed * (0.3 + (1 - ring.z));
      if (ring.z <= 0.05) return false;
      const r = ((1 / ring.z) - 1) * scale + 4;
      if (r > Math.max(w, h)) return false;
      const closeness = 1 - ring.z;
      const alpha = Math.min(1, closeness * 1.2) * (ring.bright ? 1 : 0.55);
      ctx.strokeStyle = `hsla(${ring.hue} 90% ${ring.bright ? 68 : 55}% / ${alpha})`;
      ctx.lineWidth = ring.bright ? 3.5 : 2;
      ctx.beginPath();
      const V = ring.shape.length;
      for (let i = 0; i <= V; i++) {
        const k = i % V;
        const a = (k / V) * Math.PI * 2 + twist * (ring.bright ? 1.6 : 1);
        const rr = r * (1 + ring.shape[k]);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      return true;
    });

    ctx.globalCompositeOperation = "source-over";
  }
}
