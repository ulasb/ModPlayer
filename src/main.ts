import "./style.css";
import { AudioEngine } from "./audio/engine";
import { PlayerController, type PlaybackState } from "./audio/player";
import { VizManager } from "./viz/manager";
import { SpectrumBars } from "./viz/bars";
import { Oscilloscope } from "./viz/scope";
import { RadialSpectrum } from "./viz/radial";
import { Waterfall } from "./viz/waterfall";
import { ParticleFountain } from "./viz/particles";
import { Tunnel } from "./viz/tunnel";
import { Lissajous } from "./viz/lissajous";
import { Kaleidoscope } from "./viz/kaleido";
import { Plasma } from "./viz/plasma";
import { Starfield } from "./viz/starfield";
import { WaveGrid } from "./viz/wavegrid";
import { Nebula } from "./viz/nebula";

const BASE = import.meta.env.BASE_URL;

interface DemoTrack {
  file: string;
  title: string;
  group: string;
  format: string;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <div class="logo">MUSIC<span class="accent">·</span>DECK<span class="cursor">_</span></div>
    <div class="tagline">tracker · midi · audio // 13 visualizations</div>
    <div class="spacer"></div>
    <button id="mini-toggle" title="Mini player [M]">MINI ▾</button>
    <a class="gh-link" href="https://github.com/ulasb/ModPlayer" target="_blank" rel="noopener">SOURCE ▸ GITHUB</a>
  </header>

  <div id="mini-bar">
    <img id="mini-art" alt="" hidden />
    <div id="mini-marquee"><span id="mini-marquee-text">MUSIC·DECK ✦ AWAITING SIGNAL</span></div>
    <button id="mini-list" title="Track list">≡</button>
    <button id="mini-restore" title="Full player [M]">▴</button>
  </div>

  <aside>
    <div class="side-section">
      <h2>LOAD</h2>
      <div class="load-row">
        <label class="file-btn" for="file-input">OPEN FILE…</label>
        <input type="file" id="file-input" accept=".mod,.xm,.s3m,.it,.mptm,.mtm,.669,.med,.okt,.ult,.stm,.far,.dbm,.digi,.emod,.mid,.midi,.rmi,.kar,.wav,.aif,.aiff,.flac,.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.m3u,.m3u8,.pls,.zip,.gz,audio/*" hidden />
      </div>
      <div class="url-row">
        <input type="url" id="url-input" placeholder="https://… (mod/mid/mp3/flac/zip/m3u)" />
        <button id="url-load">GET</button>
      </div>
    </div>
    <div id="archive-list"></div>
    <div class="demo-group" style="padding-top:12px">DEMO TRACKS — PUBLIC DOMAIN / CC0</div>
    <div class="demo-list" id="demo-list"></div>
  </aside>

  <main>
    <div id="viz-container"></div>
    <div id="idle-overlay">
      <div class="big">AWAITING SIGNAL_</div>
      <div class="small">pick a demo track · open a file · drop one anywhere</div>
    </div>
    <div class="hud hud-track">
      <img id="track-art" alt="" hidden />
      <div id="track-title"></div>
      <div id="track-details"></div>
    </div>
    <div class="hud hud-viz">
      <div id="viz-name"></div>
      <div class="viz-nav">
        <button id="viz-prev" title="Previous visualization [←]">◂</button>
        <button id="viz-next" title="Next visualization [→]">▸</button>
        <button id="viz-preset" title="Next Milkdrop preset [P]" style="display:none">PRESET ▸</button>
      </div>
      <div class="spacer"></div>
      <div id="status-line"></div>
    </div>
  </main>

  <div class="transport">
    <div class="transport-btns">
      <button id="btn-play" class="play" title="Play / pause [space]">▶</button>
      <button id="btn-stop" title="Stop">■</button>
      <button id="btn-repeat" title="Repeat track [R]">⟳</button>
    </div>
    <div id="time">--:-- / --:--</div>
    <div class="seek-wrap">
      <input type="range" id="seek" min="0" max="1000" value="0" />
    </div>
    <div class="vu" id="vu"></div>
    <div class="vol-wrap">
      <span class="label">VOL</span>
      <input type="range" id="vol" min="0" max="100" value="80" />
    </div>
  </div>
`;

const MUSIC_EXT =
  /\.(mod|xm|s3m|it|mptm|mtm|669|med|okt|ult|stm|far|dbm|digi|emod|sfx|amf|ams|dsm|gdm|imf|j2b|mo3|psm|ptm|umx|mid|midi|rmi|kar|wav|aif|aiff|aifc|flac|mp3|m4a|m4b|aac|ogg|oga|opus|webm)$/i;

const PLAYLIST_EXT = /\.(m3u8?|pls)$/i;

function isZip(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) ;
}

function isGzip(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  return b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const fileInput = $<HTMLInputElement>("#file-input");
const archiveList = $("#archive-list");
const urlInput = $<HTMLInputElement>("#url-input");
const demoList = $("#demo-list");
const idleOverlay = $("#idle-overlay");
const trackTitle = $("#track-title");
const trackDetails = $("#track-details");
const vizName = $("#viz-name");
const statusLine = $("#status-line");
const btnPlay = $<HTMLButtonElement>("#btn-play");
const btnPreset = $<HTMLButtonElement>("#viz-preset");
const timeEl = $("#time");
const seekEl = $<HTMLInputElement>("#seek");
const volEl = $<HTMLInputElement>("#vol");
const vuEl = $("#vu");

const VU_CELLS = 14;
for (let i = 0; i < VU_CELLS; i++) vuEl.appendChild(document.createElement("i"));
const vuCells = Array.from(vuEl.children) as HTMLElement[];

// ---------- engine / player / viz ----------

const engine = new AudioEngine();
engine.setVolume(0.8);
const player = new PlayerController(engine);

const viz = new VizManager($("#viz-container"), engine, [
  { name: "SPECTRUM", create: () => new SpectrumBars() },
  { name: "MILKDROP", create: async () => new (await import("./viz/butterchurn")).ButterchurnViz() },
  { name: "HORIZON", create: () => new WaveGrid() },
  { name: "SCOPE", create: () => new Oscilloscope() },
  { name: "RADIAL", create: () => new RadialSpectrum() },
  { name: "TUNNEL", create: () => new Tunnel() },
  { name: "PLASMA", create: () => new Plasma() },
  { name: "PARTICLES", create: () => new ParticleFountain() },
  { name: "KALEIDO", create: () => new Kaleidoscope() },
  { name: "WARP", create: () => new Starfield() },
  { name: "NEBULA", create: () => new Nebula() },
  { name: "WATERFALL", create: () => new Waterfall() },
  { name: "PHASE XY", create: () => new Lissajous() },
]);

viz.onVizChanged = (_i, name) => {
  vizName.textContent = name;
  btnPreset.style.display = viz.active?.nextPreset ? "" : "none";
};
// idle until something plays: show the default selection's name, run nothing
vizName.textContent = viz.names[0];

// ---------- status / track info ----------

let statusTimer = 0;

function setStatus(msg: string, kind: "info" | "error" | "" = "") {
  statusLine.textContent = msg;
  statusLine.className = kind === "info" ? "info" : "";
  clearTimeout(statusTimer);
  if (kind === "error") {
    statusTimer = window.setTimeout(() => (statusLine.textContent = ""), 6000);
  }
}

player.onStatus = (msg) => setStatus(msg, msg ? "info" : "");
player.onEnded = () => {
  // auto-advance to the next track in whatever list the current one came from
  let el: Element | null = activeTrackBtn?.nextElementSibling ?? null;
  while (el && !el.classList.contains("track-btn")) el = el.nextElementSibling;
  (el as HTMLElement | null)?.click();
};
player.onError = (msg) => setStatus(`ERR: ${msg}`, "error");
const trackArt = $<HTMLImageElement>("#track-art");
const miniArt = $<HTMLImageElement>("#mini-art");
const miniMarqueeText = $("#mini-marquee-text");
let artObjectUrl: string | null = null;

function renderTrackInfo(info: import("./audio/player").TrackInfo) {
  const title = info.title || "UNTITLED";
  const details = [info.format, info.details].filter(Boolean).join(" · ");
  trackTitle.textContent = title;
  trackDetails.textContent = details;
  miniMarqueeText.textContent = `${title}${details ? " ✦ " + details : ""}`;

  if (artObjectUrl) URL.revokeObjectURL(artObjectUrl);
  artObjectUrl = null;
  let src: string | null = null;
  if (info.art instanceof Blob) {
    artObjectUrl = URL.createObjectURL(info.art);
    src = artObjectUrl;
  } else if (typeof info.art === "string") {
    src = info.art;
  }
  for (const img of [trackArt, miniArt]) {
    img.hidden = !src;
    if (src) img.src = src;
  }
}

// When a file from archive.org has no embedded tags, ask the item's metadata
// API for title/artist/album and use the item image as cover art.
async function archiveOrgLookup(url: string) {
  const m = url.match(/^https?:\/\/(?:[a-z0-9-]+\.(?:us\.)?)?archive\.org\/(?:\d+\/items|download)\/([^/]+)\/([^?#]+)/i);
  if (!m) return null;
  const [, id, filePath] = m;
  const res = await fetch(`https://archive.org/metadata/${id}`);
  if (!res.ok) return null;
  const j = await res.json();
  const fname = decodeURIComponent(filePath);
  const f = (j.files as any[] | undefined)?.find((x) => x.name === fname || decodeURIComponent(x.name) === fname);
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
  return {
    title: one(f?.title),
    artist: one(f?.artist) || one(f?.creator) || one(j.metadata?.creator),
    album: one(f?.album) || one(j.metadata?.title),
    artUrl: `https://archive.org/services/img/${id}`,
  };
}

let currentSourceUrl: string | undefined;
let loadToken = 0;

player.onTrackInfo = (info) => {
  renderTrackInfo(info);
  if (!info.noTags || !currentSourceUrl) return;
  const token = loadToken;
  const url = currentSourceUrl;
  void archiveOrgLookup(url)
    .then((meta) => {
      if (!meta || token !== loadToken) return; // another track started meanwhile
      renderTrackInfo({
        ...info,
        title: meta.title ? (meta.artist ? `${meta.artist} — ${meta.title}` : meta.title) : info.title,
        details: [meta.album, info.details.replace(" · NO EMBEDDED TAGS", ""), "VIA ARCHIVE.ORG"]
          .filter(Boolean)
          .join(" · "),
        art: info.art || meta.artUrl,
      });
    })
    .catch(() => {});
};
player.onState = (state: PlaybackState) => {
  btnPlay.textContent = state === "playing" ? "❚❚" : "▶";
  if (state === "playing") {
    idleOverlay.classList.add("hidden");
    app.classList.remove("show-list"); // close the mini playlist overlay
    void viz.activate(); // re-creates the last selected visualizer
  } else if (state === "paused") {
    viz.pause(); // freeze the frame, no CPU burned while paused
  } else if (state === "stopped" || state === "idle") {
    idleOverlay.classList.remove("hidden");
    viz.deactivate(); // tear down: zero render cost while silent
    engine.level = 0; // let the VU meter go dark
  }
};

// ---------- loading ----------

let activeTrackBtn: HTMLElement | null = null;
let archiveSection: HTMLElement | null = null;

function looksLikePlaylist(buffer: ArrayBuffer, name: string): boolean {
  if (PLAYLIST_EXT.test(name)) return true;
  const head = new TextDecoder().decode(buffer.slice(0, 256)).trimStart();
  return head.startsWith("#EXTM3U") || /^\[playlist\]/i.test(head);
}

async function loadBuffer(
  buffer: ArrayBuffer,
  name: string,
  sourceBtn: HTMLElement | null = null,
  sourceUrl?: string
) {
  if (isZip(buffer)) {
    await loadArchive(buffer, name);
    return;
  }
  if (isGzip(buffer)) {
    const { gunzipSync } = await import("fflate");
    try {
      const out = gunzipSync(new Uint8Array(buffer));
      await loadBuffer(
        out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
        name.replace(/\.gz$/i, ""),
        sourceBtn
      );
    } catch {
      setStatus("ERR: could not decompress gzip file", "error");
    }
    return;
  }
  if (looksLikePlaylist(buffer, name)) {
    loadPlaylist(new TextDecoder().decode(buffer), name, sourceUrl);
    return;
  }
  // playing anything from outside the archive dismisses the archive listing
  if (archiveSection && (!sourceBtn || !archiveSection.contains(sourceBtn))) {
    archiveSection.remove();
    archiveSection = null;
  }
  activeTrackBtn?.classList.remove("active");
  activeTrackBtn = sourceBtn;
  sourceBtn?.classList.add("active");
  loadToken++;
  currentSourceUrl = sourceUrl;
  await player.load(buffer, name);
}

interface ListEntry {
  label: string;
  fmt: string;
  onPlay: (btn: HTMLButtonElement) => void;
}

/** Show a transient track list (archive contents or playlist) in the sidebar
 *  and start its first entry. Replaces any previous list. */
function showSidebarList(header: string, entries: ListEntry[]) {
  archiveSection?.remove();
  archiveSection = document.createElement("div");
  const head = document.createElement("div");
  head.className = "demo-group";
  head.textContent = header;
  archiveSection.appendChild(head);
  const buttons: HTMLButtonElement[] = [];
  for (const entry of entries) {
    const btn = document.createElement("button");
    btn.className = "track-btn";
    btn.innerHTML = `<span class="fmt">${entry.fmt}</span>`;
    btn.appendChild(document.createTextNode(entry.label));
    btn.addEventListener("click", () => entry.onPlay(btn));
    archiveSection.appendChild(btn);
    buttons.push(btn);
  }
  archiveList.appendChild(archiveSection);
  archiveList.scrollTop = 0;
  buttons[0].click();
}

/** Unpack a .zip in memory, list its music files in the sidebar, play the first. */
async function loadArchive(buffer: ArrayBuffer, archiveName: string) {
  setStatus("UNPACKING…", "info");
  const { unzipSync } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => MUSIC_EXT.test(f.name) && f.originalSize < 256 * 1024 * 1024,
    });
  } catch {
    setStatus("ERR: not a readable zip archive", "error");
    return;
  }
  const entries = Object.entries(files)
    .map(([path, data]) => ({ path, name: path.split("/").pop()!, data }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) {
    setStatus("ERR: no playable music files in archive", "error");
    return;
  }
  setStatus("");
  showSidebarList(
    `ARCHIVE: ${archiveName}`,
    entries.map((entry) => ({
      label: entry.name,
      fmt: entry.name.split(".").pop()!.toUpperCase(),
      onPlay: (btn) => {
        const d = entry.data;
        void loadBuffer(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) as ArrayBuffer, entry.name, btn);
      },
    }))
  );
}

/** Parse an M3U/M3U8/PLS playlist and list its entries in the sidebar. */
function loadPlaylist(text: string, name: string, sourceUrl?: string) {
  const raw: { url: string; title?: string }[] = [];
  if (/^\s*\[playlist\]/i.test(text)) {
    // PLS
    const files = new Map<number, string>();
    const titles = new Map<number, string>();
    for (const line of text.split(/\r?\n/)) {
      let m = line.match(/^File(\d+)\s*=\s*(.+)$/i);
      if (m) files.set(Number(m[1]), m[2].trim());
      m = line.match(/^Title(\d+)\s*=\s*(.+)$/i);
      if (m) titles.set(Number(m[1]), m[2].trim());
    }
    for (const k of [...files.keys()].sort((a, b) => a - b)) {
      raw.push({ url: files.get(k)!, title: titles.get(k) });
    }
  } else {
    // M3U / M3U8 / plain URL list
    let pending: string | undefined;
    for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
      if (!line) continue;
      if (line.startsWith("#")) {
        const m = line.match(/^#EXTINF:[^,]*,(.*)$/);
        if (m) pending = m[1].trim();
        continue;
      }
      if (line.includes("<")) continue; // not a URL — likely an HTML error page
      raw.push({ url: line, title: pending });
      pending = undefined;
    }
  }

  let skipped = 0;
  const entries = raw.flatMap((e) => {
    try {
      const u = new URL(e.url, sourceUrl); // relative paths resolve against the playlist URL
      if (u.protocol === "http:" || u.protocol === "https:") {
        return [{ url: u.href, title: e.title || decodeURIComponent(u.pathname.split("/").pop() || e.url) }];
      }
    } catch {
      /* unresolvable (e.g. local path in an uploaded playlist) */
    }
    skipped++;
    return [];
  });

  if (entries.length === 0) {
    setStatus("ERR: playlist has no resolvable http(s) entries", "error");
    return;
  }
  setStatus(skipped ? `${skipped} local/unresolvable entr${skipped === 1 ? "y" : "ies"} skipped` : "", skipped ? "info" : "");

  showSidebarList(
    `PLAYLIST: ${name}`,
    entries.map((entry) => ({
      label: entry.title,
      fmt: (entry.url.split(".").pop() || "?").slice(0, 4).toUpperCase(),
      onPlay: (btn) => void loadUrl(entry.url, btn, entry.title),
    }))
  );
}

async function loadUrl(url: string, sourceBtn: HTMLElement | null = null, displayName?: string) {
  try {
    setStatus("FETCHING…", "info");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    setStatus("");
    const name = displayName || decodeURIComponent(url.split("/").pop() || "remote file");
    await loadBuffer(buffer, name, sourceBtn, url);
  } catch (err) {
    setStatus(
      `ERR: ${err instanceof Error ? err.message : err} — remote host may not allow CORS`,
      "error"
    );
  }
}

fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  await loadBuffer(await f.arrayBuffer(), f.name);
  fileInput.value = "";
});

$("#url-load").addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (url) void loadUrl(url);
});
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const url = urlInput.value.trim();
    if (url) void loadUrl(url);
  }
});

// drag & drop anywhere
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) await loadBuffer(await f.arrayBuffer(), f.name);
});

// ---------- demo tracks ----------

async function loadDemoList() {
  try {
    const res = await fetch(BASE + "demo/manifest.json");
    const tracks: DemoTrack[] = (await res.json()).tracks;
    const groups = [...new Set(tracks.map((t) => t.group))];
    for (const g of groups) {
      const head = document.createElement("div");
      head.className = "demo-group";
      head.textContent = g;
      demoList.appendChild(head);
      for (const t of tracks.filter((x) => x.group === g)) {
        const btn = document.createElement("button");
        btn.className = "track-btn";
        btn.innerHTML = `<span class="fmt">${t.format}</span>`;
        btn.appendChild(document.createTextNode(t.title));
        btn.addEventListener("click", () => void loadUrl(BASE + "demo/" + t.file, btn, t.title));
        demoList.appendChild(btn);
      }
    }
  } catch {
    const err = document.createElement("div");
    err.className = "demo-group";
    err.textContent = "demo track list unavailable";
    demoList.appendChild(err);
  }
}
void loadDemoList();

// ---------- transport ----------

btnPlay.addEventListener("click", () => {
  void engine.resume();
  player.togglePause();
});
$("#btn-stop").addEventListener("click", () => player.stop());

const btnRepeat = $<HTMLButtonElement>("#btn-repeat");
let repeatOn = false;

function toggleRepeat() {
  repeatOn = !repeatOn;
  player.setRepeat(repeatOn);
  btnRepeat.classList.toggle("active", repeatOn);
}
btnRepeat.addEventListener("click", toggleRepeat);

let seeking = false;
seekEl.addEventListener("pointerdown", () => (seeking = true));
seekEl.addEventListener("change", () => {
  const dur = player.getDuration();
  if (dur > 0) player.seek((Number(seekEl.value) / 1000) * dur);
  seeking = false;
});

volEl.addEventListener("input", () => engine.setVolume(Number(volEl.value) / 100));

$("#viz-prev").addEventListener("click", () => viz.prev());
$("#viz-next").addEventListener("click", () => viz.next());
btnPreset.addEventListener("click", () => viz.active?.nextPreset?.());

// ---------- mini player mode ----------
// Manual choice wins; otherwise auto-engage when the window gets small.
const miniQuery = window.matchMedia("(max-width: 620px), (max-height: 440px)");
let miniManual: boolean | null = null;

function applyMini() {
  app.classList.toggle("mini", miniManual ?? miniQuery.matches);
}

function setMini(on: boolean) {
  // choosing what auto would pick anyway clears the override
  miniManual = on === miniQuery.matches ? null : on;
  applyMini();
}

miniQuery.addEventListener("change", applyMini);
$("#mini-toggle").addEventListener("click", () => setMini(true));
$("#mini-restore").addEventListener("click", () => setMini(false));
$("#mini-list").addEventListener("click", () => app.classList.toggle("show-list"));
applyMini();

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === "url") return;
  switch (e.key) {
    case " ":
      e.preventDefault();
      void engine.resume();
      player.togglePause();
      break;
    case "ArrowRight":
      viz.next();
      break;
    case "ArrowLeft":
      viz.prev();
      break;
    case "p":
    case "P":
      viz.active?.nextPreset?.();
      break;
    case "r":
    case "R":
      toggleRepeat();
      break;
    case "m":
    case "M":
      setMini(!app.classList.contains("mini"));
      break;
  }
});

// ---------- UI tick: clock, seek bar, VU ----------

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

setInterval(() => {
  player.tick();
  const pos = player.getPosition();
  const dur = player.getDuration();
  timeEl.textContent = `${fmtTime(pos)} / ${fmtTime(dur)}`;
  if (!seeking && dur > 0) {
    const v = Math.round((pos / dur) * 1000);
    seekEl.value = String(v);
    seekEl.style.setProperty("--fill", `${v / 10}%`);
  }
}, 120);

(function vuLoop() {
  requestAnimationFrame(vuLoop);
  const lit = Math.round(Math.min(1, engine.level * 1.6) * VU_CELLS);
  for (let i = 0; i < VU_CELLS; i++) {
    const cell = vuCells[i];
    const frac = i / VU_CELLS;
    cell.className =
      i < lit ? (frac < 0.6 ? "on-g" : frac < 0.85 ? "on-a" : "on-r") : "";
  }
})();
