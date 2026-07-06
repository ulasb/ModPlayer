import type { AudioEngine } from "../audio/engine";
import type { Visualizer } from "./types";

/**
 * Owns the render loop and the lifecycle of the active visualizer.
 * Visualizers are supplied lazily so heavyweight ones (Butterchurn) only
 * load their code when first selected.
 */
export class VizManager {
  private current: Visualizer | null = null;
  private currentIndex = -1;
  private rafId = 0;
  private lastT = 0;
  private resizeObserver: ResizeObserver;

  onVizChanged: (index: number, name: string) => void = () => {};

  constructor(
    private container: HTMLElement,
    private engine: AudioEngine,
    private factories: { name: string; create: () => Promise<Visualizer> | Visualizer }[]
  ) {
    this.resizeObserver = new ResizeObserver(() => {
      this.current?.resize(this.container.clientWidth, this.container.clientHeight);
    });
    this.resizeObserver.observe(container);
  }

  get names(): string[] {
    return this.factories.map((f) => f.name);
  }

  get index(): number {
    return this.currentIndex;
  }

  get active(): Visualizer | null {
    return this.current;
  }

  private selectToken = 0;
  private targetIndex = 0;

  async select(index: number) {
    const n = this.factories.length;
    index = ((index % n) + n) % n;
    this.targetIndex = index;
    if (index === this.currentIndex && this.current) return;
    const token = ++this.selectToken;
    const factory = this.factories[index];
    const viz = await factory.create();
    // A newer select() superseded this one while its module was loading
    if (token !== this.selectToken) return;
    this.current?.destroy();
    this.currentIndex = index;
    this.current = viz;
    viz.init(this.container, this.engine);
    this.onVizChanged(index, factory.name);
  }

  next() {
    void this.select(this.targetIndex + 1);
  }
  prev() {
    void this.select(this.targetIndex - 1);
  }

  start() {
    const loop = (t: number) => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.lastT ? t - this.lastT : 16.7;
      this.lastT = t;
      this.engine.update(t);
      this.current?.render(t, dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }
}
