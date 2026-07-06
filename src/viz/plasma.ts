import { Canvas2DVisualizer } from "./types";

/** Old-school demoscene plasma; the bass drives it, the palette breathes. */
export class Plasma extends Canvas2DVisualizer {
  readonly name = "PLASMA";
  private off!: HTMLCanvasElement;
  private octx!: CanvasRenderingContext2D;
  private img!: ImageData;
  private p1 = 0;
  private p2 = 0;
  private p3 = 0;
  private palette: Uint8Array = new Uint8Array(256 * 3);
  private paletteHue = -1;

  private static readonly W = 180;
  private static readonly H = 102;

  protected setup() {
    this.off = document.createElement("canvas");
    this.off.width = Plasma.W;
    this.off.height = Plasma.H;
    this.octx = this.off.getContext("2d")!;
    this.img = this.octx.createImageData(Plasma.W, Plasma.H);
  }

  private buildPalette(baseHue: number) {
    const key = Math.round(baseHue);
    if (key === this.paletteHue) return;
    this.paletteHue = key;
    for (let i = 0; i < 256; i++) {
      const ph = (i / 256) * Math.PI * 2;
      const hue = ((baseHue + Math.sin(ph) * 60) % 360 + 360) % 360;
      const light = 0.18 + 0.4 * (0.5 + 0.5 * Math.sin(ph * 2 + 1));
      const [r, g, b] = hslToRgb(hue / 360, 0.9, light);
      this.palette[i * 3] = r;
      this.palette[i * 3 + 1] = g;
      this.palette[i * 3 + 2] = b;
    }
  }

  render(t: number, dt: number) {
    const { engine } = this;
    const W = Plasma.W;
    const H = Plasma.H;
    const k = dt * 0.001;
    this.p1 += k * (0.6 + engine.bass * 5);
    this.p2 += k * (0.9 + engine.mid * 4);
    this.p3 += k * (0.4 + engine.treble * 5);
    this.buildPalette((t * 0.008) % 360);

    const d = this.img.data;
    const pal = this.palette;
    const boost = engine.level * 90 + engine.beatPulse * 60;
    let o = 0;
    for (let y = 0; y < H; y++) {
      const dy = y / H - 0.5;
      for (let x = 0; x < W; x++) {
        const dx = x / W - 0.5;
        const v =
          Math.sin(x * 0.11 + this.p1) +
          Math.sin(y * 0.13 - this.p2) +
          Math.sin((x + y) * 0.07 + this.p3) +
          Math.sin(Math.sqrt(dx * dx + dy * dy) * 22 - this.p1 * 1.5);
        const idx = (Math.floor((v + 4) * 32 + boost) & 255) * 3;
        d[o++] = pal[idx];
        d[o++] = pal[idx + 1];
        d[o++] = pal[idx + 2];
        d[o++] = 255;
      }
    }
    this.octx.putImageData(this.img, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
