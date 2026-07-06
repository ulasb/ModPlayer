# Attribution & Licenses

## Bundled demo tracks

### Tracker modules (public domain, via [The Mod Archive](https://modarchive.org))

All modules below were published by their authors under a **Public Domain** license
(Mod Archive "view by license: publicdomain" listing).

| File | Title / Artist | Mod Archive ID |
| --- | --- | --- |
| `drozerix_-_neon_techno.mod` | Neon Techno — Drozerix | [178172](https://modarchive.org/module.php?178172) |
| `drozerix_-_stardust_jam.mod` | Stardust Jam — Drozerix | [201039](https://modarchive.org/module.php?201039) |
| `jam_-_highway_encounter.mod` | Highway Encounter — JAM | [211660](https://modarchive.org/module.php?211660) |
| `chip_overture.xm` | Chip Overture | [172185](https://modarchive.org/module.php?172185) |
| `keygen_9000.xm` | Keygen 9000 | [173938](https://modarchive.org/module.php?173938) |
| `katiecadet-chipdisco.it` | ChipDisco — Katie Cadet | [174981](https://modarchive.org/module.php?174981) |
| `kj_jose_-_a_new_frontend.s3m` | A New Frontend — KJ Jose | [178540](https://modarchive.org/module.php?178540) |

### MIDI files (public domain, via the [Mutopia Project](https://www.mutopiaproject.org))

All typesets below are marked **Public Domain** by their typesetters; the underlying
compositions are public domain.

| File | Piece | Source |
| --- | --- | --- |
| `bach_prelude_c_bwv846.mid` | J.S. Bach — Prelude in C major, BWV 846 | [Mutopia](https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/) |
| `beethoven_fur_elise.mid` | L. van Beethoven — Für Elise, WoO 59 | [Mutopia](https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/) |
| `mozart_rondo_alla_turca.mid` | W.A. Mozart — Rondo alla Turca, K. 331 | [Mutopia](https://www.mutopiaproject.org/ftp/MozartWA/KV331/KV331_3_RondoAllaTurca/) |
| `joplin_the_entertainer.mid` | Scott Joplin — The Entertainer | [Mutopia](https://www.mutopiaproject.org/ftp/JoplinS/entertainer/) |
| `debussy_clair_de_lune.mid` | Claude Debussy — Clair de Lune, L. 75 | [Mutopia](https://www.mutopiaproject.org/ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/) |

## SoundFont

`public/soundfont/gm.sf3` is **GeneralUser GS** (SF3 build) by S. Christian Collins,
obtained via the [SpessaSynth](https://github.com/spessasus/SpessaSynth) repository.
Free to use and distribute — see the
[GeneralUser GS license](https://schristiancollins.com/generaluser.php).

## Libraries

| Library | Purpose | License |
| --- | --- | --- |
| [libopenmpt](https://lib.openmpt.org/libopenmpt/) via [chiptune3](https://github.com/DrSnuggles/chiptune) | MOD/XM/S3M/IT playback | BSD-3-Clause / MIT |
| [SpessaSynth](https://github.com/spessasus/spessasynth_lib) | MIDI + SoundFont synthesis | Apache-2.0 |
| [Butterchurn](https://github.com/jberg/butterchurn) | Milkdrop 2 visualization | MIT |
| [butterchurn-presets](https://github.com/jberg/butterchurn-presets) | Milkdrop presets | Presets under their own licenses |

`public/lib/` contains verbatim copies of the chiptune3/libopenmpt worklet files and the
SpessaSynth audio worklet processor, so they can be served unbundled (AudioWorklet modules).
`src/vendor/chiptune3.ts` is a TypeScript adaptation of chiptune3's MIT-licensed player class.
