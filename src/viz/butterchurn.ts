import butterchurn, { type ButterchurnVisualizer } from "butterchurn";
import butterchurnPresets from "butterchurn-presets";
import type { AudioEngine } from "../audio/engine";
import type { Visualizer } from "./types";

const PRESET_ROTATION_MS = 25000;
const BLEND_SECONDS = 2.7;

/** Milkdrop 2 presets rendered by Butterchurn (WebGL). */
export class ButterchurnViz implements Visualizer {
  readonly name = "MILKDROP";
  private canvas!: HTMLCanvasElement;
  private label!: HTMLDivElement;
  private visualizer: ButterchurnVisualizer | null = null;
  private engine!: AudioEngine;
  private presetKeys: string[] = [];
  private presetIndex = 0;
  private lastSwitch = 0;
  private cssW = 0;
  private cssH = 0;

  init(container: HTMLElement, engine: AudioEngine) {
    this.engine = engine;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viz-canvas";
    container.appendChild(this.canvas);

    this.label = document.createElement("div");
    this.label.className = "preset-label";
    container.appendChild(this.label);

    const presets = butterchurnPresets.getPresets();
    this.presetKeys = Object.keys(presets);
    this.presetIndex = Math.floor(Math.random() * this.presetKeys.length);

    this.cssW = container.clientWidth;
    this.cssH = container.clientHeight;
    this.canvas.width = this.cssW;
    this.canvas.height = this.cssH;
    this.visualizer = butterchurn.createVisualizer(engine.ctx as AudioContext, this.canvas, {
      width: this.cssW,
      height: this.cssH,
    });
    this.visualizer.connectAudio(engine.master);
    this.applyPreset(0);
  }

  private applyPreset(blend: number) {
    const presets = butterchurnPresets.getPresets();
    const key = this.presetKeys[this.presetIndex];
    this.visualizer?.loadPreset(presets[key], blend);
    this.lastSwitch = performance.now();
    this.label.textContent = key;
    this.label.classList.remove("flash");
    void this.label.offsetWidth; // restart the fade animation
    this.label.classList.add("flash");
  }

  nextPreset() {
    this.presetIndex = (this.presetIndex + 1) % this.presetKeys.length;
    this.applyPreset(BLEND_SECONDS);
  }

  render(t: number) {
    if (!this.visualizer) return;
    if (t - this.lastSwitch > PRESET_ROTATION_MS) this.nextPreset();
    this.visualizer.render();
  }

  resize(width: number, height: number) {
    this.cssW = width;
    this.cssH = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.visualizer?.setRendererSize(width, height);
  }

  destroy() {
    try {
      this.visualizer?.disconnectAudio(this.engine.master);
    } catch {
      /* already disconnected */
    }
    this.canvas.remove();
    this.label.remove();
  }
}
