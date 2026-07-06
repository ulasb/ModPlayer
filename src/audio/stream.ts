import type { AudioEngine } from "./engine";

/**
 * Backend for regular audio files (wav/aiff/flac/mp3/aac/ogg/…).
 *
 * Primary path: an <audio> element feeding a MediaElementAudioSourceNode —
 * streaming decode, native seeking, minimal memory. If the element can't
 * play the container (e.g. AIFF in Chrome), falls back to a full
 * decodeAudioData() + AudioBufferSourceNode player.
 */
export class StreamPlayer {
  private el: HTMLAudioElement;
  private blobUrl: string | null = null;
  private mode: "element" | "buffer" = "element";
  private repeat = false;

  // buffer-mode state
  private buffer: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  private startedAt = 0; // ctx.currentTime when the current source started
  private offset = 0; // position within the buffer at that moment
  private bufPlaying = false;
  private intentionalStop = false;

  onEnded: () => void = () => {};

  constructor(private engine: AudioEngine) {
    this.el = new Audio();
    this.el.preload = "auto";
    const node = engine.ctx.createMediaElementSource(this.el);
    node.connect(engine.master);
    this.el.addEventListener("ended", () => this.onEnded());
  }

  /** Loads and starts playback. Returns which decode path is in use. */
  async load(buffer: ArrayBuffer, mime: string): Promise<"element" | "buffer"> {
    this.stop();
    const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
    const elementOk = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        this.el.removeEventListener("canplay", onCan);
        this.el.removeEventListener("error", onErr);
        resolve(ok);
      };
      const onCan = () => done(true);
      const onErr = () => done(false);
      this.el.addEventListener("canplay", onCan);
      this.el.addEventListener("error", onErr);
      this.el.src = url;
      this.el.load();
    });

    if (elementOk) {
      if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = url;
      this.mode = "element";
      this.el.loop = this.repeat;
      await this.el.play();
      return "element";
    }

    // element refused the container — try a full decode (throws if the
    // browser has no decoder for it at all)
    URL.revokeObjectURL(url);
    this.el.removeAttribute("src");
    this.buffer = await this.engine.ctx.decodeAudioData(buffer.slice(0));
    this.mode = "buffer";
    this.offset = 0;
    this.startSource();
    return "buffer";
  }

  private startSource() {
    if (!this.buffer) return;
    const src = this.engine.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.repeat;
    src.connect(this.engine.master);
    src.onended = () => {
      if (this.intentionalStop) return;
      this.bufPlaying = false;
      this.onEnded();
    };
    src.start(0, this.offset % this.buffer.duration);
    this.src = src;
    this.startedAt = this.engine.ctx.currentTime;
    this.bufPlaying = true;
  }

  private stopSource() {
    if (!this.src) return;
    this.intentionalStop = true;
    try {
      this.src.stop();
    } catch {
      /* already stopped */
    }
    this.src.disconnect();
    this.src = null;
    this.intentionalStop = false;
  }

  pause() {
    if (this.mode === "element") {
      this.el.pause();
    } else if (this.bufPlaying) {
      this.offset = this.getPosition();
      this.stopSource();
      this.bufPlaying = false;
    }
  }

  resume() {
    if (this.mode === "element") void this.el.play();
    else if (!this.bufPlaying) this.startSource();
  }

  stop() {
    if (this.mode === "element") {
      this.el.pause();
      if (this.el.src) this.el.currentTime = 0;
    } else {
      this.stopSource();
      this.bufPlaying = false;
      this.offset = 0;
    }
  }

  seek(seconds: number) {
    if (this.mode === "element") {
      this.el.currentTime = seconds;
    } else if (this.buffer) {
      this.offset = Math.min(Math.max(0, seconds), this.buffer.duration - 0.05);
      if (this.bufPlaying) {
        this.stopSource();
        this.startSource();
      }
    }
  }

  setRepeat(on: boolean) {
    this.repeat = on;
    this.el.loop = on;
    if (this.src) this.src.loop = on;
  }

  getPosition(): number {
    if (this.mode === "element") return this.el.currentTime || 0;
    if (!this.buffer) return 0;
    const pos = this.bufPlaying
      ? this.offset + (this.engine.ctx.currentTime - this.startedAt)
      : this.offset;
    return this.buffer.duration > 0 ? pos % this.buffer.duration : pos;
  }

  getDuration(): number {
    if (this.mode === "element") {
      const d = this.el.duration;
      return isFinite(d) ? d : 0;
    }
    return this.buffer?.duration ?? 0;
  }
}
