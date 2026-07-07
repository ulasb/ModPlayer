/**
 * File System Access helpers: feature detection, IndexedDB persistence for
 * the default save-folder handle, and permission re-acquisition.
 * Chromium-only API — callers fall back to <input webkitdirectory> /
 * <a download> where it's missing.
 */

export const fsAccessSupported = "showDirectoryPicker" in window;

const DB_NAME = "musicdeck";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const DIR_KEY = "save-dir-handle";

export async function getSavedDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idbGet<FileSystemDirectoryHandle>(DIR_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setSavedDir(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(DIR_KEY, handle);
}

/** Re-acquire readwrite permission on a restored handle (needs a user gesture). */
export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission?.(opts)) === "granted") return true;
  return (await handle.requestPermission?.(opts)) === "granted";
}

export async function writeFileToDir(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  buffer: ArrayBuffer
): Promise<void> {
  const safe = fileName.replace(/[/\\?%*:|"<>]/g, "_");
  const fh = await dir.getFileHandle(safe, { create: true });
  const w = await fh.createWritable();
  await w.write(buffer);
  await w.close();
}

/** Recursively collect music files from a directory handle. */
export async function collectMusicFiles(
  dir: FileSystemDirectoryHandle,
  matches: (name: string) => boolean,
  depth = 0
): Promise<{ path: string; name: string; handle: FileSystemFileHandle }[]> {
  const out: { path: string; name: string; handle: FileSystemFileHandle }[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (out.length >= 2000) break;
    if (handle.kind === "file" && matches(name)) {
      out.push({ path: name, name, handle: handle as FileSystemFileHandle });
    } else if (handle.kind === "directory" && depth < 4 && !name.startsWith(".")) {
      const nested = await collectMusicFiles(handle as FileSystemDirectoryHandle, matches, depth + 1);
      for (const e of nested) out.push({ ...e, path: `${name}/${e.path}` });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
