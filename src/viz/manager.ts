import type { AudioEngine } from "../audio/engine";
import type { Visualizer } from "./types";

/**
 * Owns the render loop and the lifecycle of the active visualizer.
 * Visualizers are supplied lazily so heavyweight ones (Butterchurn) only
 * load their code when first selected.
 *
 * Lifecycle: while nothing is playing the manager is *deactivated* — no
 * visualizer exists and no animation frame is scheduled, so idle cost is
 * zero. activate() re-creates the last selected visualizer; pause()/resume()
 * freeze and unfreeze the loop without tearing the visualizer down.
 */
export class VizManager {
  private current: Visualizer | null = null;
  private currentIndex = -1;
  private rafId = 0;
  private lastT = 0;
  private running = false;
  private enabled = false;
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
    if (!this.enabled) {
      // idle: just remember the choice and update the label
      this.onVizChanged(index, this.factories[index].name);
      return;
    }
    if (index === this.currentIndex && this.current) return;
    const token = ++this.selectToken;
    const factory = this.factories[index];
    const viz = await factory.create();
    // A newer select() superseded this one, or playback stopped, while the
    // module was loading
    if (token !== this.selectToken || !this.enabled) return;
    this.current?.destroy();
    this.currentIndex = index;
    this.current = viz;
    viz.init(this.container, this.engine);
    this.onVizChanged(index, factory.name);
    // if the loop is frozen (paused playback), still show one fresh frame
    if (!this.running) {
      this.engine.update(performance.now());
      viz.render(performance.now(), 16.7);
    }
  }

  next() {
    void this.select(this.targetIndex + 1);
  }
  prev() {
    void this.select(this.targetIndex - 1);
  }

  /** Create the last selected visualizer (if needed) and run the loop. */
  async activate() {
    if (!this.enabled) {
      this.enabled = true;
      await this.select(this.targetIndex);
    }
    this.resume();
  }

  /** Tear down the visualizer and stop the loop entirely (idle state). */
  deactivate() {
    this.enabled = false;
    this.pause();
    this.selectToken++; // invalidate any in-flight select()
    this.current?.destroy();
    this.current = null;
    this.currentIndex = -1;
  }

  /** Freeze the render loop, keeping the visualizer and its last frame. */
  pause() {
    if (this.running) {
      cancelAnimationFrame(this.rafId);
      this.running = false;
      this.lastT = 0;
    }
  }

  resume() {
    if (this.running || !this.enabled) return;
    this.running = true;
    const loop = (t: number) => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.lastT ? t - this.lastT : 16.7;
      this.lastT = t;
      this.engine.update(t);
      this.current?.render(t, dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}
