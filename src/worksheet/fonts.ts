const DB = "my-park-files";
const STORE = "files";
const FONT_KEY = "hand-font";

type FontRecord = { buf: ArrayBuffer; label: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function handFamily(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-hand-family")
    .trim()
    .replace(/^["']|["']$/g, "");
  const family = raw || "Patrick Hand";
  return family.includes(" ") ? `"${family}"` : family;
}

async function applyFont(buf: ArrayBuffer, label: string) {
  const family = "Park Hand";
  const face = new FontFace(family, buf);
  await face.load();
  document.fonts.add(face);
  document.documentElement.style.setProperty(
    "--font-hand",
    `"${family}", "Patrick Hand", cursive`,
  );
  document.documentElement.style.setProperty("--font-hand-family", family);
  document.documentElement.dataset.handLabel = label;
}

export async function saveHandFont(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, "");
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ buf, label } satisfies FontRecord, FONT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await applyFont(buf, label);
  return label;
}

export async function loadStoredFont(): Promise<string | null> {
  try {
    const db = await openDb();
    const record = await new Promise<FontRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(FONT_KEY);
      request.onsuccess = () => resolve(request.result as FontRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!record?.buf) return null;
    await applyFont(record.buf, record.label || "Your font");
    return record.label || "Your font";
  } catch {
    return null;
  }
}

export async function clearHandFont() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(FONT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  document.documentElement.style.removeProperty("--font-hand");
  document.documentElement.style.removeProperty("--font-hand-family");
  delete document.documentElement.dataset.handLabel;
}
