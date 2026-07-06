import { ChiptuneJsPlayer } from "../vendor/chiptune3";
import { StreamPlayer } from "./stream";
import type { AudioEngine } from "./engine";

export interface TrackInfo {
  title: string;
  format: string;
  details: string;
}

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "stopped";

const BASE = import.meta.env.BASE_URL;
const CHIPTUNE_WORKLET_URL = BASE + "lib/chiptune3.worklet.js";
const SPESSA_WORKLET_URL = BASE + "lib/spessasynth_processor.min.js";
const SOUNDFONT_URL = BASE + "soundfont/gm.sf3";

function isMidi(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const b = new Uint8Array(buffer, 0, 12);
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (tag === "MThd") return true;
  // RMID: RIFF....RMID
  return tag === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "RMID";
}

const AUDIO_EXT_MIME: Record<string, [string, string]> = {
  wav: ["audio/wav", "WAV"],
  aif: ["audio/aiff", "AIFF"],
  aiff: ["audio/aiff", "AIFF"],
  aifc: ["audio/aiff", "AIFF"],
  flac: ["audio/flac", "FLAC"],
  mp3: ["audio/mpeg", "MP3"],
  m4a: ["audio/mp4", "M4A"],
  m4b: ["audio/mp4", "M4A"],
  alac: ["audio/mp4", "ALAC"],
  aac: ["audio/aac", "AAC"],
  ogg: ["audio/ogg", "OGG"],
  oga: ["audio/ogg", "OGG"],
  opus: ["audio/ogg", "OPUS"],
  webm: ["audio/webm", "WEBM"],
};

/** Detect a plain audio file: extension first, then container magic bytes. */
function audioKind(buffer: ArrayBuffer, fileName: string): [string, string] | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXT_MIME[ext]) return AUDIO_EXT_MIME[ext];
  if (buffer.byteLength < 12) return null;
  const b = new Uint8Array(buffer, 0, 12);
  const tag = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (tag(0, 4) === "RIFF" && tag(8, 4) === "WAVE") return AUDIO_EXT_MIME.wav;
  if (tag(0, 4) === "FORM" && (tag(8, 4) === "AIFF" || tag(8, 4) === "AIFC")) return AUDIO_EXT_MIME.aiff;
  if (tag(0, 4) === "fLaC") return AUDIO_EXT_MIME.flac;
  if (tag(0, 4) === "OggS") return AUDIO_EXT_MIME.ogg;
  if (tag(4, 4) === "ftyp") return AUDIO_EXT_MIME.m4a;
  if (tag(0, 3) === "ID3") return AUDIO_EXT_MIME.mp3;
  if (b[0] === 0xff && (b[1] & 0xf0) === 0xf0) return AUDIO_EXT_MIME.aac; // ADTS
  return null;
}

/**
 * Unified facade over the two backends: libopenmpt (tracker modules) and
 * SpessaSynth (MIDI). Detects the format from file contents, lazy-initializes
 * whichever backend is needed, and exposes one transport interface.
 */
export class PlayerController {
  private mod: ChiptuneJsPlayer | null = null;
  private midiSynth: import("spessasynth_lib").WorkletSynthesizer | null = null;
  private midiSeq: import("spessasynth_lib").Sequencer | null = null;
  private stream: StreamPlayer | null = null;

  private active: "mod" | "midi" | "stream" | null = null;
  private buffer: ArrayBuffer | null = null;
  private fileName = "";
  private repeat = false;
  state: PlaybackState = "idle";

  onTrackInfo: (info: TrackInfo) => void = () => {};
  onState: (state: PlaybackState) => void = () => {};
  onEnded: () => void = () => {};
  onError: (message: string) => void = () => {};
  onStatus: (message: string) => void = () => {};

  constructor(private engine: AudioEngine) {}

  private setState(s: PlaybackState) {
    this.state = s;
    this.onState(s);
  }

  private async ensureMod(): Promise<ChiptuneJsPlayer> {
    if (this.mod) return this.mod;
    this.onStatus("LOADING LIBOPENMPT…");
    const player = new ChiptuneJsPlayer(this.engine.ctx, CHIPTUNE_WORKLET_URL, {
      repeatCount: this.repeat ? -1 : 0,
    });
    await player.ready;
    player.gain.connect(this.engine.master);
    player.onMetadata((meta) => {
      if (this.active !== "mod") return;
      const channels = Array.isArray(meta.song?.channels) ? meta.song!.channels!.length : 0;
      this.onTrackInfo({
        title: (meta.title as string) || this.fileName,
        format: ((meta.type as string) || "MOD").toUpperCase(),
        details: [
          channels ? `${channels}CH` : "",
          (meta.tracker as string) || "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    });
    player.onEnded(() => {
      if (this.active !== "mod") return;
      this.setState("stopped");
      this.onEnded();
    });
    player.onError((e) => {
      if (this.active !== "mod") return;
      this.setState("idle");
      this.onError(`libopenmpt could not parse this file (${e.type})`);
    });
    this.mod = player;
    return player;
  }

  private async ensureMidi() {
    if (this.midiSynth && this.midiSeq) return { synth: this.midiSynth, seq: this.midiSeq };
    const { WorkletSynthesizer, Sequencer } = await import("spessasynth_lib");
    await this.engine.ctx.audioWorklet.addModule(SPESSA_WORKLET_URL);
    const synth = new WorkletSynthesizer(this.engine.ctx);
    synth.connect(this.engine.master);
    this.onStatus("LOADING SOUNDFONT…");
    const res = await fetch(SOUNDFONT_URL);
    if (!res.ok) throw new Error(`soundfont fetch failed: HTTP ${res.status}`);
    await synth.soundBankManager.addSoundBank(await res.arrayBuffer(), "main");
    await synth.isReady;
    const seq = new Sequencer(synth);
    seq.loopCount = 0;
    this.midiSynth = synth;
    this.midiSeq = seq;
    return { synth, seq };
  }

  private ensureStream(): StreamPlayer {
    if (this.stream) return this.stream;
    const stream = new StreamPlayer(this.engine);
    stream.onEnded = () => {
      if (this.active !== "stream") return;
      this.setState("stopped");
      this.onEnded();
    };
    this.stream = stream;
    return stream;
  }

  async load(buffer: ArrayBuffer, fileName: string) {
    await this.engine.resume();
    this.stopInternal();
    this.buffer = buffer;
    this.fileName = fileName;
    this.setState("loading");
    this.onStatus("");

    try {
      const audio = audioKind(buffer, fileName);
      if (audio) {
        const [mime, label] = audio;
        this.active = "stream";
        const stream = this.ensureStream();
        stream.setRepeat(this.repeat);
        let mode: "element" | "buffer";
        try {
          mode = await stream.load(buffer.slice(0), mime);
        } catch {
          throw new Error(`this browser has no decoder for ${label}`);
        }
        this.onTrackInfo({
          title: fileName.replace(/\.[a-z0-9]+$/i, ""),
          format: label,
          details: mode === "element" ? "NATIVE STREAMING" : "FULL DECODE",
        });
      } else if (isMidi(buffer)) {
        this.active = "midi";
        const { seq } = await this.ensureMidi();
        seq.loadNewSongList([{ binary: buffer.slice(0), fileName }]);
        // the synth core treats Infinity (not -1) as "loop forever"
        seq.loopCount = this.repeat ? Infinity : 0;
        seq.currentTime = 0;
        seq.play();
        this.onTrackInfo({
          title: fileName.replace(/\.(mid|midi|rmi|kar)$/i, ""),
          format: "MIDI",
          details: "GENERAL MIDI · SPESSASYNTH",
        });
      } else {
        this.active = "mod";
        const mod = await this.ensureMod();
        mod.play(buffer.slice(0));
      }
      this.setState("playing");
      this.onStatus("");
    } catch (err) {
      this.setState("idle");
      this.onTrackInfo({ title: fileName, format: "", details: "COULD NOT PLAY" });
      this.onError(err instanceof Error ? err.message : String(err));
    }
  }

  private stopInternal() {
    if (this.active === "mod") this.mod?.stop();
    if (this.active === "midi" && this.midiSeq) {
      this.midiSeq.pause();
      this.midiSynth?.stopAll(true);
    }
    if (this.active === "stream") this.stream?.stop();
  }

  togglePause() {
    if (this.state === "playing") {
      if (this.active === "mod") this.mod?.pause();
      else if (this.active === "midi") this.midiSeq?.pause();
      else this.stream?.pause();
      this.setState("paused");
    } else if (this.state === "paused") {
      if (this.active === "mod") this.mod?.unpause();
      else if (this.active === "midi") this.midiSeq?.play();
      else this.stream?.resume();
      this.setState("playing");
    } else if (this.state === "stopped" && this.buffer) {
      void this.load(this.buffer, this.fileName);
    }
  }

  stop() {
    if (this.state === "playing" || this.state === "paused") {
      this.stopInternal();
      this.setState("stopped");
    }
  }

  /** Toggle repeat; applies immediately to whichever backend is active. */
  setRepeat(on: boolean) {
    this.repeat = on;
    this.mod?.setRepeatCount(on ? -1 : 0);
    if (this.midiSeq) this.midiSeq.loopCount = on ? Infinity : 0;
    this.stream?.setRepeat(on);
  }

  seek(seconds: number) {
    if (this.active === "mod") this.mod?.setPos(seconds);
    else if (this.active === "midi" && this.midiSeq) this.midiSeq.currentTime = seconds;
    else if (this.active === "stream") this.stream?.seek(seconds);
  }

  getPosition(): number {
    if (this.active === "mod") {
      const pos = this.mod?.currentTime ?? 0;
      const dur = this.mod?.duration ?? 0;
      // when repeating, libopenmpt's clock runs past the end — wrap for display
      return dur > 0 && pos > dur ? pos % dur : pos;
    }
    if (this.active === "midi") return this.midiSeq?.currentTime ?? 0;
    if (this.active === "stream") return this.stream?.getPosition() ?? 0;
    return 0;
  }

  getDuration(): number {
    if (this.active === "mod") return this.mod?.duration ?? 0;
    if (this.active === "midi") return this.midiSeq?.duration ?? 0;
    if (this.active === "stream") return this.stream?.getDuration() ?? 0;
    return 0;
  }

  /** Called each UI tick; detects MIDI song end (no event for it). */
  tick() {
    if (this.active === "midi" && this.state === "playing" && this.midiSeq?.isFinished) {
      this.setState("stopped");
      this.onEnded();
    }
  }
}
