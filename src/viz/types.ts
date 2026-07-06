import type { AudioEngine } from "../audio/engine";

export interface Visualizer {
  /** Display name shown in the selector */
  readonly name: string;
  /** Create canvas / GL resources inside the container */
  init(container: HTMLElement, engine: AudioEngine): void;
  /** Draw one frame. `t` is ms since page load, `dt` ms since last frame. */
  render(t: number, dt: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
  /** Optional: visualizers with internal presets (e.g. Milkdrop) expose this */
  nextPreset?(): void;
}

/** Convenience base for 2D-canvas visualizers. */
export abstract class Canvas2DVisualizer implements Visualizer {
  abstract readonly name: string;
  protected canvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  protected engine!: AudioEngine;
  protected w = 0;
  protected h = 0;

  init(container: HTMLElement, engine: AudioEngine) {
    this.engine = engine;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viz-canvas";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize(container.clientWidth, container.clientHeight);
    this.setup();
  }

  /** Optional post-init hook */
  protected setup() {}

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.floor(width * dpr));
    this.h = Math.max(1, Math.floor(height * dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.onResize();
  }

  /** Optional resize hook */
  protected onResize() {}

  abstract render(t: number, dt: number): void;

  destroy() {
    this.canvas.remove();
  }
}
