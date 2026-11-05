import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  scriptUrl: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(180),
  pdfBase64: z.string().max(7_000_000).optional(),
  ping: z.boolean().optional(),
  password: z.string(),
});

export type SaveResult =
  | { ok: true; detail: string }
  | { ok: false; message: string };

function driveMessage(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "Google Drive took too long. Press Save again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not reach Google Drive.";
}

export const saveParkPdf = createServerFn({ method: "POST" })
  .validator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }): Promise<SaveResult> => {
    let url: URL;
    try {
      url = new URL(data.scriptUrl);
    } catch {
      return { ok: false, message: "That Drive link is not a proper web address." };
    }
    if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
      return {
        ok: false,
        message: "Use the web app link from script.google.com.",
      };
    }
    if (!data.ping && !data.pdfBase64) {
      return { ok: false, message: "The worksheet file was empty." };
    }

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          password: data.password,
          filename: data.filename,
          pdfBase64: data.pdfBase64 ?? "",
          ping: Boolean(data.ping),
        }),
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      const text = await response.text();
      let parsed: { ok?: boolean; error?: string; name?: string; ping?: boolean } | null =
        null;
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
        return {
          ok: false,
          message: parsed.error || "Google Drive did not accept the worksheet.",
        };
      }
      if (data.ping) return { ok: true, detail: "The Drive link is working." };
      return {
        ok: true,
        detail: parsed.name
          ? `Sent to Google Drive as ${parsed.name}.`
          : "Sent to Google Drive.",
      };
    } catch (error) {
      return { ok: false, message: driveMessage(error) };
    }
  });
