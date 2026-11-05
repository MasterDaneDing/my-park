import { drawScene, ensureImage, sceneSources } from "./art";
import { handFamily } from "./fonts";
import { type Draft, pdfFilename, posterSentences, posterTitle } from "./model";

const DOTS = ["#d7263d", "#2f86c4", "#2f8a32", "#6d4ca3", "#e56a93"];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildWorksheetPdf(draft: Draft): Promise<{ blob: Blob; filename: string }> {
  const hand = handFamily();
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(`400 40px ${hand}`),
    document.fonts.load("800 72px Nunito"),
  ]);
  await Promise.all([
    ...sceneSources(draft.place).map((src) => ensureImage(src)),
    ...draft.stickers.map((sticker) => (sticker.src ? ensureImage(sticker.src) : null)),
  ]);

  const width = 1240;
  const height = 1754;
  const page = document.createElement("canvas");
  page.width = width;
  page.height = height;
  const ctx = page.getContext("2d");
  if (!ctx) throw new Error("Could not draw the worksheet.");

  ctx.fillStyle = "#2f8a32";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff7ea";
  ctx.beginPath();
  ctx.roundRect(28, 28, width - 56, height - 56, 28);
  ctx.fill();

  ctx.fillStyle = "#d7263d";
  ctx.font = "800 34px Nunito";
  ctx.textAlign = "center";
  ctx.fillText("Worksheet 6", width / 2, 96);
  ctx.font = "800 78px Nunito";
  const title = posterTitle(draft);
  ctx.fillText(title.length > 22 ? title.slice(0, 22) : title, width / 2, 186);

  ctx.fillStyle = "#24324a";
  ctx.font = `400 40px ${hand}`;
  ctx.fillText(
    `Name: ${draft.name.trim() || "……"}      Class: ${draft.className || "……"}`,
    width / 2,
    260,
  );

  const sentences = posterSentences(draft);
  let y = 340;
  ctx.textAlign = "left";
  sentences.forEach((sentence, index) => {
    ctx.font = `400 40px ${hand}`;
    const lines = wrapText(ctx, sentence, 960);
    ctx.fillStyle = DOTS[index] ?? "#d7263d";
    ctx.beginPath();
    ctx.arc(110, y - 12, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24324a";
    for (const line of lines) {
      ctx.fillText(line, 146, y);
      y += 54;
    }
    y += 16;
  });

  const parkTop = Math.max(y + 10, 700);
  const parkH = Math.max(420, height - parkTop - 64);
  const parkW = 1080;
  const park = document.createElement("canvas");
  park.width = parkW;
  park.height = parkH;
  const parkCtx = park.getContext("2d");
  if (!parkCtx) throw new Error("Could not draw the park.");
  drawScene(parkCtx, parkW, parkH, {
    relation: draft.relation,
    place: draft.place,
    stickers: draft.stickers,
    selectedId: null,
  });
  ctx.drawImage(park, (width - parkW) / 2, Math.min(parkTop, height - parkH - 48), parkW, parkH);

  const { jsPDF } = await import("jspdf");
  const jpeg = page.toDataURL("image/jpeg", 0.86);
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4", compress: true });
  pdf.addImage(
    jpeg,
    "JPEG",
    0,
    0,
    pdf.internal.pageSize.getWidth(),
    pdf.internal.pageSize.getHeight(),
  );
  return { blob: pdf.output("blob"), filename: pdfFilename(draft) };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
