# MUSIC·DECK

A single-page music player — tracker modules, MIDI, and regular audio files — with
13 real-time audio visualizations, styled as a CRT demoscene deck.

**Live: <https://ulasb.github.io/ModPlayer/>**

![screenshot](docs/screenshot.png)

## Features

- **Tracker playback** — MOD / XM / S3M / IT (and every other format libopenmpt speaks),
  rendered by [libopenmpt](https://lib.openmpt.org/libopenmpt/) compiled to WebAssembly,
  running in an AudioWorklet (via [chiptune3](https://github.com/DrSnuggles/chiptune)).
- **MIDI playback** — .mid / .rmi / .kar synthesized in the browser by
  [SpessaSynth](https://github.com/spessasus/spessasynth_lib) with the GeneralUser GS
  SoundFont (lazy-loaded on first MIDI play).
- **Audio files** — FLAC, WAV, MP3, AAC/M4A, OGG/Opus, WebM via the browser's native
  decoders (streaming `<audio>` element with a `decodeAudioData` fallback). AIFF and
  ALAC play where the browser has a decoder (Safari); otherwise a clear error is shown.
- **Playlists** — M3U / M3U8 / PLS by URL or upload; entries appear as a sidebar
  playlist, and playback auto-advances to the next track in any list (playlist,
  archive, or demo tracks).
- **Three ways to load music** — bundled public-domain demo tracks, a local file
  (picker or drag-and-drop anywhere), or a direct URL (needs CORS on the remote host).
- **Compressed archives** — `.zip` archives (from any load path) are unpacked in the
  browser ([fflate](https://github.com/101arrowz/fflate)); their music files appear as
  a playlist in the sidebar and the first one auto-plays. Single `.gz` files work too.
- **13 visualizations**, all fed from one shared `AnalyserNode` pipeline
  (frequency, waveform, stereo channels, beat detection):

  | | | |
  |---|---|---|
  | SPECTRUM — LED segment analyzer | MILKDROP — [Butterchurn](https://github.com/jberg/butterchurn) (Milkdrop 2, WebGL, auto-rotating presets) | HORIZON — synthwave spectrum mountains |
  | SCOPE — triggered phosphor oscilloscope | RADIAL — rotating circular spectrum | TUNNEL — fly-through spectrum rings |
  | PLASMA — demoscene plasma, bass-driven | PARTICLES — fountain + beat bursts | KALEIDO — 8-way mirrored kaleidoscope |
  | WARP — audio-throttled starfield | NEBULA — layered polar waveform flower | WATERFALL — scrolling spectrogram |
  | PHASE XY — stereo goniometer | | |

- **Transport** — play/pause/stop, repeat, seeking, volume, VU meter, track metadata
  (format, channels, tracker), embedded cover art. Untagged files loaded from
  archive.org URLs get title/album/art from the archive.org metadata API.
- **Mini player** — a compact Winamp-style deck (scrolling marquee, viz strip,
  transport) via the MINI button or `M`; engages automatically when the window
  gets small. The ≡ button overlays the track list.
- **Keyboard** — `space` play/pause, `R` repeat, `M` mini player, `←`/`→` switch
  visualization, `P` next Milkdrop preset.
- **Installable & offline** — a PWA with a Workbox service worker that precaches the
  app shell, audio worklets, soundfont, and demo tracks, so the installed app works
  with no network connection.

## Development

```sh
npm install
npm run dev       # local dev server
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build
```

Deployment is automatic: every push to `main` builds and publishes to GitHub Pages
via `.github/workflows/deploy.yml`.

## Architecture

```
src/
  audio/engine.ts     WebAudio graph + per-frame analysis (FFT, RMS, bands, beats)
  audio/player.ts     unified transport facade over the two backends
  vendor/chiptune3.ts TS adaptation of the chiptune3 player (MIT)
  viz/manager.ts      render loop + visualizer lifecycle
  viz/*.ts            one file per visualization
public/
  lib/                AudioWorklet modules (libopenmpt, SpessaSynth) served unbundled
  soundfont/gm.sf3    GeneralUser GS (SF3)
  demo/               public-domain demo tracks + manifest
```

Both players route into a master `GainNode`, which feeds an `AnalyserNode` chain
(combined + per-channel). Visualizers only read the shared analysis arrays — they
never touch WebAudio, so switching them is instant and side-effect free.

## Licenses

Code is MIT. Bundled components and demo tracks are under their own (permissive /
public-domain) licenses — see [ATTRIBUTION.md](ATTRIBUTION.md).
