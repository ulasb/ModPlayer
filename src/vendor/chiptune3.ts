/*
 * Adapted from chiptune3.js (MIT) — https://github.com/DrSnuggles/chiptune
 * Changes: TypeScript, worklet loaded from an explicit URL (so the two
 * worklet files can live in /public and survive bundling), promise-based init.
 * The compiled libopenmpt worklet remains under the OpenMPT BSD license.
 */

export interface ChiptuneMetadata {
  dur: number;
  title?: string;
  artist?: string;
  song?: { channels?: unknown[] };
  type?: string;
  tracker?: string;
  message?: string;
  totalOrders?: number;
  totalPatterns?: number;
  [key: string]: unknown;
}

export interface ChiptuneProgress {
  pos: number;
  order: number;
  pattern: number;
  row: number;
}

interface ChiptuneConfig {
  repeatCount: number;
  stereoSeparation: number;
  interpolationFilter: number;
}

const defaultCfg: ChiptuneConfig = {
  repeatCount: 0, // play once
  stereoSeparation: 100,
  interpolationFilter: 0,
};

type Handler = { eventName: string; handler: (response?: any) => void };

export class ChiptuneJsPlayer {
  config: ChiptuneConfig;
  context: BaseAudioContext;
  gain: GainNode;
  processNode: AudioWorkletNode | null = null;
  meta: ChiptuneMetadata | null = null;
  duration = 0;
  currentTime = 0;
  order = 0;
  pattern = 0;
  row = 0;
  ready: Promise<void>;
  private handlers: Handler[] = [];

  constructor(context: AudioContext, workletUrl: string, cfg?: Partial<ChiptuneConfig>) {
    this.config = { ...defaultCfg, ...cfg };
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 1;

    this.ready = context.audioWorklet.addModule(workletUrl).then(() => {
      this.processNode = new AudioWorkletNode(this.context, "libopenmpt-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.processNode.port.onmessage = this.handleMessage.bind(this);
      this.processNode.port.postMessage({ cmd: "config", val: this.config });
      this.processNode.connect(this.gain);
      this.fireEvent("onInitialized");
    });
  }

  private handleMessage(msg: MessageEvent) {
    switch (msg.data.cmd) {
      case "meta":
        this.meta = msg.data.meta;
        this.duration = msg.data.meta.dur;
        this.fireEvent("onMetadata", this.meta);
        break;
      case "pos":
        this.currentTime = msg.data.pos;
        this.order = msg.data.order;
        this.pattern = msg.data.pattern;
        this.row = msg.data.row;
        this.fireEvent("onProgress", msg.data);
        break;
      case "end":
        this.fireEvent("onEnded");
        break;
      case "err":
        this.fireEvent("onError", { type: msg.data.val });
        break;
    }
  }

  private fireEvent(eventName: string, response?: any) {
    for (const h of this.handlers) {
      if (h.eventName === eventName) h.handler(response);
    }
  }

  private addHandler(eventName: string, handler: (response?: any) => void) {
    this.handlers.push({ eventName, handler });
  }

  onEnded(handler: () => void) {
    this.addHandler("onEnded", handler);
  }
  onError(handler: (err: { type: string }) => void) {
    this.addHandler("onError", handler);
  }
  onMetadata(handler: (meta: ChiptuneMetadata) => void) {
    this.addHandler("onMetadata", handler);
  }
  onProgress(handler: (p: ChiptuneProgress) => void) {
    this.addHandler("onProgress", handler);
  }

  private postMsg(cmd: string, val?: unknown) {
    this.processNode?.port.postMessage({ cmd, val });
  }

  play(buffer: ArrayBuffer) {
    this.postMsg("play", buffer);
  }
  stop() {
    this.postMsg("stop");
  }
  pause() {
    this.postMsg("pause");
  }
  unpause() {
    this.postMsg("unpause");
  }
  setRepeatCount(val: number) {
    this.postMsg("repeatCount", val);
  }
  setPos(seconds: number) {
    this.postMsg("setPos", seconds);
  }
  setVol(val: number) {
    this.gain.gain.value = val;
  }
}
