import { TEACHER_PASSWORD } from "./model";

export const SCRIPT_URL_KEY = "my-park-script-url";

/** Built in so every iPad saves without pasting the link. A saved link on one iPad can still replace it. */
export const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwPAjlLXwYmBD27v3W96oZEAH6vkzFd6ncHqCgEgTuEYWqPG76N31Urnd5_KmwwRLqn/exec";

export function readScriptUrl(): string {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_URL;
  const stored = localStorage.getItem(SCRIPT_URL_KEY)?.trim();
  return stored || DEFAULT_SCRIPT_URL;
}

export function writeScriptUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(SCRIPT_URL_KEY, trimmed);
  else localStorage.removeItem(SCRIPT_URL_KEY);
}

export function appsScriptSource(): string {
  return `var FOLDER_NAME = 'My Park Worksheets';
var PASSWORD = '${TEACHER_PASSWORD}';

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json({ ok: true, message: 'My Park script is ready.' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data || data.password !== PASSWORD) {
      return json({ ok: false, error: 'Teacher password was rejected.' });
    }
    if (data.ping) return json({ ok: true, ping: true });
    if (!data.pdfBase64 || !data.filename) {
      return json({ ok: false, error: 'Missing worksheet file.' });
    }
    var folder = getFolder_();
    var name = String(data.filename).replace(/[\\\\/]/g, '').slice(0, 180);
    var oldFiles = folder.getFilesByName(name);
    while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.pdfBase64),
      'application/pdf',
      name
    );
    var file = folder.createFile(blob);
    return json({ ok: true, id: file.getId(), name: file.getName() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function getFolder_() {
  var matches = DriveApp.getFoldersByName(FOLDER_NAME);
  return matches.hasNext() ? matches.next() : DriveApp.createFolder(FOLDER_NAME);
}
`;
}
