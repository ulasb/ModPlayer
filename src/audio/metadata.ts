/**
 * Minimal, dependency-free tag readers for the audio-file backend:
 *   ID3v2.2/2.3/2.4 + ID3v1 (MP3), Vorbis comments (FLAC / OGG / Opus),
 *   and MP4 ilst atoms (M4A / AAC). Extracts title, artist, album, and
 *   embedded cover art. All parsing is best-effort — any structural
 *   surprise just yields fewer tags, never an exception.
 */

export interface AudioTags {
  title?: string;
  artist?: string;
  album?: string;
  art?: Blob;
}

const MAX_ART_BYTES = 10 * 1024 * 1024;

const latin1 = (b: Uint8Array, off: number, len: number) =>
  String.fromCharCode(...b.subarray(off, off + len));
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const syncsafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

function clean(s: string): string {
  return s.replace(/\0+$/g, "").trim();
}

export function parseTags(buffer: ArrayBuffer): AudioTags {
  const b = new Uint8Array(buffer);
  try {
    if (latin1(b, 0, 3) === "ID3") return parseId3v2(b);
    if (latin1(b, 0, 4) === "fLaC") return parseFlac(b);
    if (latin1(b, 0, 4) === "OggS") return parseOggComments(b);
    if (latin1(b, 4, 4) === "ftyp") return parseMp4(b);
    if (b[0] === 0xff) return parseId3v1(b); // headerless MPEG stream
  } catch {
    /* malformed tags — fall back to filename */
  }
  return {};
}

// ---------- ID3 ----------

function decodeId3Text(body: Uint8Array): string {
  const enc = body[0];
  const rest = body.subarray(1);
  if (enc === 0) return clean(latin1(rest, 0, rest.length));
  if (enc === 3) return clean(new TextDecoder("utf-8").decode(rest));
  // 1 = UTF-16 with BOM, 2 = UTF-16BE without
  const be = enc === 2 || (rest[0] === 0xfe && rest[1] === 0xff);
  const text = new TextDecoder(be ? "utf-16be" : "utf-16le").decode(
    rest[0] === 0xff || rest[0] === 0xfe ? rest.subarray(2) : rest
  );
  return clean(text);
}

/** Index just past a text terminator (single or double null per encoding). */
function skipTerminated(b: Uint8Array, off: number, enc: number): number {
  if (enc === 1 || enc === 2) {
    for (let i = off; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i + 2;
  } else {
    for (let i = off; i < b.length; i++) if (b[i] === 0) return i + 1;
  }
  return b.length;
}

function parseId3v2(b: Uint8Array): AudioTags {
  const tags: AudioTags = {};
  const ver = b[3];
  const flags = b[5];
  const end = Math.min(10 + syncsafe(b, 6), b.length);
  let off = 10;
  if (flags & 0x40 && ver >= 3) {
    off += ver === 4 ? syncsafe(b, 10) : 4 + u32be(b, 10); // extended header
  }
  const v22 = ver === 2;
  const headLen = v22 ? 6 : 10;
  const idLen = v22 ? 3 : 4;

  while (off + headLen <= end) {
    const id = latin1(b, off, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding
    const size = v22
      ? (b[off + 3] << 16) | (b[off + 4] << 8) | b[off + 5]
      : ver === 4
        ? syncsafe(b, off + 4)
        : u32be(b, off + 4);
    const body = b.subarray(off + headLen, Math.min(off + headLen + size, end));
    if (id === "TIT2" || id === "TT2") tags.title = decodeId3Text(body);
    else if (id === "TPE1" || id === "TP1") tags.artist = decodeId3Text(body);
    else if (id === "TALB" || id === "TAL") tags.album = decodeId3Text(body);
    else if ((id === "APIC" || id === "PIC") && !tags.art && body.length < MAX_ART_BYTES) {
      const enc = body[0];
      let p: number;
      let mime: string;
      if (v22) {
        const fmt = latin1(body, 1, 3).toUpperCase();
        mime = fmt === "PNG" ? "image/png" : "image/jpeg";
        p = 4;
      } else {
        const mimeEnd = body.indexOf(0, 1);
        mime = latin1(body, 1, mimeEnd - 1) || "image/jpeg";
        p = mimeEnd + 1;
      }
      p += 1; // picture type
      p = skipTerminated(body, p, enc); // description
      if (p < body.length) tags.art = new Blob([body.slice(p)], { type: mime });
    }
    off += headLen + size;
  }
  return tags;
}

function parseId3v1(b: Uint8Array): AudioTags {
  if (b.length < 128) return {};
  const t = b.subarray(b.length - 128);
  if (latin1(t, 0, 3) !== "TAG") return {};
  return {
    title: clean(latin1(t, 3, 30)) || undefined,
    artist: clean(latin1(t, 33, 30)) || undefined,
    album: clean(latin1(t, 63, 30)) || undefined,
  };
}

// ---------- Vorbis comments (FLAC / OGG / Opus) ----------

function readVorbisComments(b: Uint8Array, off: number, tags: AudioTags) {
  const vendorLen = u32le(b, off);
  off += 4 + vendorLen;
  const count = u32le(b, off);
  off += 4;
  if (count > 1024) return;
  const dec = new TextDecoder("utf-8");
  for (let i = 0; i < count && off + 4 <= b.length; i++) {
    const len = u32le(b, off);
    off += 4;
    if (len > 8 * 1024 * 1024 || off + len > b.length) return;
    const entry = dec.decode(b.subarray(off, off + len));
    off += len;
    const eq = entry.indexOf("=");
    if (eq < 0) continue;
    const key = entry.slice(0, eq).toUpperCase();
    const val = entry.slice(eq + 1).trim();
    if (key === "TITLE" && !tags.title) tags.title = val;
    else if (key === "ARTIST" && !tags.artist) tags.artist = val;
    else if (key === "ALBUM" && !tags.album) tags.album = val;
    else if (key === "METADATA_BLOCK_PICTURE" && !tags.art) {
      try {
        const bin = atob(val);
        const pic = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) pic[j] = bin.charCodeAt(j);
        readFlacPicture(pic, 0, tags);
      } catch {
        /* bad base64 */
      }
    }
  }
}

function readFlacPicture(b: Uint8Array, off: number, tags: AudioTags) {
  off += 4; // picture type
  const mimeLen = u32be(b, off);
  const mime = latin1(b, off + 4, mimeLen);
  off += 4 + mimeLen;
  const descLen = u32be(b, off);
  off += 4 + descLen + 16; // desc + width/height/depth/colors
  const dataLen = u32be(b, off);
  off += 4;
  if (dataLen > 0 && dataLen < MAX_ART_BYTES && off + dataLen <= b.length) {
    tags.art = new Blob([b.slice(off, off + dataLen)], { type: mime || "image/jpeg" });
  }
}

function parseFlac(b: Uint8Array): AudioTags {
  const tags: AudioTags = {};
  let off = 4;
  while (off + 4 <= b.length) {
    const head = b[off];
    const type = head & 0x7f;
    const size = (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3];
    if (type === 4) readVorbisComments(b, off + 4, tags);
    else if (type === 6 && !tags.art) readFlacPicture(b, off + 4, tags);
    off += 4 + size;
    if (head & 0x80) break; // last metadata block
  }
  return tags;
}

function parseOggComments(b: Uint8Array): AudioTags {
  const tags: AudioTags = {};
  // The comment header lives in the first few pages; scan a bounded window
  // for the vorbis/opus marker. Best-effort: a comment block spanning page
  // boundaries will simply fail the sanity checks above.
  const window = b.subarray(0, Math.min(b.length, 256 * 1024));
  const markers: [string, number][] = [
    ["\x03vorbis", 7],
    ["OpusTags", 8],
  ];
  for (const [marker, skip] of markers) {
    outer: for (let i = 0; i < window.length - marker.length; i++) {
      for (let j = 0; j < marker.length; j++) {
        if (window[i + j] !== marker.charCodeAt(j)) continue outer;
      }
      readVorbisComments(b, i + skip, tags);
      return tags;
    }
  }
  return tags;
}

// ---------- MP4 / M4A ----------

function atomSize(b: Uint8Array, off: number): number {
  const s = u32be(b, off);
  if (s === 1) {
    // 64-bit size
    return Number(new DataView(b.buffer, b.byteOffset + off + 8, 8).getBigUint64(0));
  }
  return s;
}

function findAtom(b: Uint8Array, start: number, end: number, type: string): [number, number] | null {
  let off = start;
  while (off + 8 <= end) {
    const size = atomSize(b, off) || end - off;
    if (latin1(b, off + 4, 4) === type) {
      const headLen = u32be(b, off) === 1 ? 16 : 8;
      return [off + headLen, Math.min(off + size, end)];
    }
    if (size < 8) break;
    off += size;
  }
  return null;
}

function parseMp4(b: Uint8Array): AudioTags {
  const tags: AudioTags = {};
  const moov = findAtom(b, 0, b.length, "moov");
  if (!moov) return tags;
  const udta = findAtom(b, moov[0], moov[1], "udta");
  if (!udta) return tags;
  const meta = findAtom(b, udta[0], udta[1], "meta");
  if (!meta) return tags;
  const ilst = findAtom(b, meta[0] + 4, meta[1], "ilst"); // meta has 4 version/flags bytes
  if (!ilst) return tags;

  let off = ilst[0];
  while (off + 8 <= ilst[1]) {
    const size = atomSize(b, off);
    if (size < 8) break;
    const name =
      b[off + 4] === 0xa9 ? "©" + latin1(b, off + 5, 3) : latin1(b, off + 4, 4);
    const data = findAtom(b, off + 8, off + size, "data");
    if (data) {
      const dataType = u32be(b, data[0]) & 0xffffff;
      const payload = b.subarray(data[0] + 8, data[1]); // skip verflags + locale
      if (dataType === 1) {
        const text = clean(new TextDecoder("utf-8").decode(payload));
        if (name === "©nam") tags.title = text;
        else if (name === "©ART") tags.artist = text;
        else if (name === "aART" && !tags.artist) tags.artist = text;
        else if (name === "©alb") tags.album = text;
      } else if (name === "covr" && !tags.art && payload.length < MAX_ART_BYTES) {
        tags.art = new Blob([payload.slice(0)], {
          type: dataType === 14 ? "image/png" : "image/jpeg",
        });
      }
    }
    off += size;
  }
  return tags;
}
