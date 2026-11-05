export type SaveResult =
  | { ok: true; detail: string }
  | { ok: false; message: string };

export async function postToDrive(input: {
  scriptUrl: string;
  filename: string;
  pdfBase64?: string;
  ping?: boolean;
  password: string;
}): Promise<SaveResult> {
  let url: URL;
  try {
    url = new URL(input.scriptUrl);
  } catch {
    return { ok: false, message: "That Drive link is not a proper web address." };
  }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
    return { ok: false, message: "Use the web app link from script.google.com." };
  }
  if (!input.ping && !input.pdfBase64) {
    return { ok: false, message: "The worksheet file was empty." };
  }
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        password: input.password,
        filename: input.filename,
        pdfBase64: input.pdfBase64 ?? "",
        ping: Boolean(input.ping),
      }),
    });
    const text = await response.text();
    let parsed: { ok?: boolean; error?: string; name?: string } | null = null;
    try {
      parsed = JSON.parse(text) as { ok?: boolean; error?: string; name?: string };
    } catch {
      parsed = null;
    }
    if (!response.ok || !parsed) {
      return {
        ok: false,
        message:
          "Google Drive sent an unexpected reply. Deploy the script as a web app, execute as you, and allow anyone to open the link.",
      };
    }
    if (!parsed.ok) {
      return { ok: false, message: parsed.error || "Google Drive did not accept the worksheet." };
    }
    if (input.ping) return { ok: true, detail: "The Drive link is working." };
    return {
      ok: true,
      detail: parsed.name ? `Sent to Google Drive as ${parsed.name}.` : "Sent to Google Drive.",
    };
  } catch {
    return { ok: false, message: "Could not reach Google Drive." };
  }
}
