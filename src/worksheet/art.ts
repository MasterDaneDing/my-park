import type { Place, Relation, Sticker } from "./model";

const INK = "#24324a";
const PAPER = "#fff7ea";
const GRASS = "#7ed04f";
const GRASS_DEEP = "#4ea338";
const SKY = "#8fd4f5";
const SUN = "#ffd15c";
const BERRY = "#d7263d";
const WOOD = "#c4844a";
const WOOD_DARK = "#8a5a2b";
const BLUE = "#3d8bdb";
const WHITE = "#ffffff";

export const GRASS_SRC = "/park/grass.jpg";

export const SIGN_SRC: Record<Place, string> = {
  cinema: "/park/signs/cinema.png",
  clinic: "/park/signs/clinic.png",
  "fire station": "/park/signs/fire-station.png",
  "police station": "/park/signs/police-station.png",
  restaurant: "/park/signs/restaurant.png",
  "post office": "/park/signs/post-office.png",
  bank: "/park/signs/bank.png",
  supermarket: "/park/signs/supermarket.png",
};

export function sceneSources(place: Place): string[] {
  return [GRASS_SRC, SIGN_SRC[place]];
}

const LEGACY_BOX: Record<string, { w: number; h: number }> = {
  tree: { w: 0.18, h: 0.28 },
  flower: { w: 0.11, h: 0.18 },
  bush: { w: 0.16, h: 0.13 },
  bench: { w: 0.22, h: 0.14 },
  blanket: { w: 0.24, h: 0.16 },
  swing: { w: 0.18, h: 0.24 },
  slide: { w: 0.22, h: 0.22 },
  bin: { w: 0.12, h: 0.16 },
  kite: { w: 0.16, h: 0.22 },
  pond: { w: 0.24, h: 0.15 },
};

export function stickerBox(sticker: Sticker): { w: number; h: number } {
  if (sticker.kind === "drawing") {
    const w = 0.28;
    return { w, h: w * (sticker.aspect || 1) };
  }
  if (sticker.src && sticker.aspect) {
    const h = 0.22;
    let w = h / sticker.aspect;
    if (w > 0.42) {
      w = 0.42;
      return { w, h: w * sticker.aspect };
    }
    return { w, h };
  }
  return LEGACY_BOX[sticker.kind] ?? { w: 0.18, h: 0.22 };
}

type Box = { x: number; y: number; w: number; h: number };
type GateSide = "top" | "bottom" | "left";
type SceneLayout = { park: Box; street: Box; building: Box; gate: GateSide; gateAt: number };

function sceneLayout(relation: Relation): SceneLayout {
  if (relation === "in front of") {
    return {
      building: { x: 0.5, y: 0.02, w: 0.42, h: 0.32 },
      street: { x: 0, y: 0.28, w: 1, h: 0.16 },
      park: { x: 0.06, y: 0.44, w: 0.88, h: 0.5 },
      gate: "top",
      gateAt: 0.32,
    };
  }
  if (relation === "behind") {
    return {
      park: { x: 0.06, y: 0.04, w: 0.88, h: 0.46 },
      street: { x: 0, y: 0.5, w: 1, h: 0.5 },
      building: { x: 0.5, y: 0.44, w: 0.42, h: 0.44 },
      gate: "bottom",
      gateAt: 0.28,
    };
  }
  return {
    building: { x: 0.02, y: 0.16, w: 0.34, h: 0.66 },
    street: { x: 0, y: 0.78, w: 1, h: 0.22 },
    park: { x: 0.4, y: 0.05, w: 0.56, h: 0.73 },
    gate: "left",
    gateAt: 0.72,
  };
}

function scaleBox(box: Box, w: number, h: number): Box {
  return { x: box.x * w, y: box.y * h, w: box.w * w, h: box.h * h };
}

export function buildingFrame(relation: Relation, w: number, h: number) {
  return scaleBox(sceneLayout(relation).building, w, h);
}

export function dropPoint(relation: Relation, index: number): { x: number; y: number } {
  const park = sceneLayout(relation).park;
  const col = index % 3;
  const row = Math.floor(index / 3) % 3;
  return {
    x: park.x + park.w * (0.22 + col * 0.28),
    y: park.y + park.h * (0.24 + row * 0.26),
  };
}

const imageCache = new Map<string, HTMLImageElement>();
const imagePending = new Map<string, Promise<HTMLImageElement | null>>();

export function cachedImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null;
}

export function ensureImage(src: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = imagePending.get(src);
  if (pending) return pending;
  const next = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      imagePending.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      imagePending.delete(src);
      resolve(null);
    };
    img.src = src;
  });
  imagePending.set(src, next);
  return next;
}

type Scene = {
  relation: Relation;
  place: Place;
  stickers: Sticker[];
  selectedId: string | null;
};

function traceRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  traceRound(ctx, 0, 0, w, h, Math.min(22, w * 0.03));
  ctx.clip();
  const lay = sceneLayout(scene.relation);
  const park = scaleBox(lay.park, w, h);
  const street = scaleBox(lay.street, w, h);
  const building = scaleBox(lay.building, w, h);
  drawSky(ctx, w, h);
  drawStreet(ctx, street);
  drawParkPlot(ctx, park);
  drawEntrance(ctx, park, lay.gate, lay.gateAt);
  if (scene.relation === "behind") {
    drawFence(ctx, park, lay.gate, lay.gateAt);
    drawBuilding(ctx, building);
  } else {
    drawBuilding(ctx, building);
    drawFence(ctx, park, lay.gate, lay.gateAt);
  }
  drawPlaceSign(ctx, scene.place, building, h, park);
  for (const sticker of scene.stickers) {
    drawSticker(ctx, sticker, w, h, sticker.id === scene.selectedId);
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(4, w * 0.008);
  ctx.strokeStyle = INK;
  traceRound(ctx, 2, 2, w - 4, h - 4, Math.min(22, w * 0.03));
  ctx.stroke();
  ctx.restore();
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.1, Math.min(w, h) * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  blob(ctx, w * 0.78, h * 0.08, w * 0.055);
  blob(ctx, w * 0.58, h * 0.05, w * 0.035);
}

function drawStreet(ctx: CanvasRenderingContext2D, street: Box) {
  const { x, y, w, h } = street;
  ctx.fillStyle = "#d5d9e3";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#c2c8d4";
  ctx.fillRect(x, y, w, Math.max(7, h * 0.1));
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.045);
  ctx.setLineDash([Math.max(16, w * 0.035), Math.max(12, w * 0.022)]);
  ctx.beginPath();
  ctx.moveTo(x + 16, y + h * 0.58);
  ctx.lineTo(x + w - 16, y + h * 0.58);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawParkPlot(ctx: CanvasRenderingContext2D, park: Box) {
  fillGrass(ctx, park.x, park.y, park.w, park.h);
  ctx.save();
  ctx.strokeStyle = "rgba(36, 90, 28, 0.35)";
  ctx.lineWidth = 5;
  ctx.strokeRect(park.x, park.y, park.w, park.h);
  ctx.restore();
}

function drawEntrance(ctx: CanvasRenderingContext2D, park: Box, gate: GateSide, at: number) {
  const span = Math.min(park.w, park.h);
  const step = span * 0.07;
  let gx = park.x + park.w * 0.5;
  let gy = park.y;
  let dx = 0;
  let dy = -1;
  if (gate === "top") {
    gx = park.x + park.w * at;
    gy = park.y;
    dy = -1;
  } else if (gate === "bottom") {
    gx = park.x + park.w * at;
    gy = park.y + park.h;
    dy = 1;
  } else {
    gx = park.x;
    gy = park.y + park.h * at;
    dx = -1;
    dy = 0;
  }
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let i = -1; i < 4; i++) {
    const cx = gx + dx * step * (i + 0.15);
    const cy = gy + dy * step * (i + 0.15);
    ctx.fillStyle = i < 0 ? "#d5e2b4" : "#eeeae1";
    ctx.beginPath();
    ctx.ellipse(cx, cy, step * 0.46, step * 0.3, dx === 0 ? 0 : Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFence(ctx: CanvasRenderingContext2D, park: Box, gate: GateSide, at: number) {
  const ph = Math.max(18, Math.min(park.w, park.h) * 0.075);
  const pw = Math.max(7, ph * 0.36);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, ph * 0.08);
  drawFenceSide(ctx, park.x, park.y, park.w, true, gate === "top", at, ph, pw, "up");
  drawFenceSide(ctx, park.x, park.y + park.h, park.w, true, gate === "bottom", at, ph, pw, "down");
  drawFenceSide(ctx, park.x, park.y, park.h, false, gate === "left", at, ph, pw, "left");
  drawFenceSide(ctx, park.x + park.w, park.y, park.h, false, false, at, ph, pw, "right");
  drawPost(ctx, park.x, park.y, pw, ph);
  drawPost(ctx, park.x + park.w, park.y, pw, ph);
  drawPost(ctx, park.x, park.y + park.h, pw, ph);
  drawPost(ctx, park.x + park.w, park.y + park.h, pw, ph);
  ctx.restore();
}

function drawFenceSide(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  horizontal: boolean,
  open: boolean,
  at: number,
  ph: number,
  pw: number,
  dir: "up" | "down" | "left" | "right",
) {
  const gap = open ? Math.min(length * 0.2, ph * 3.4) : 0;
  const gapCenter = length * at;
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = Math.max(3, ph * 0.12);
  ctx.beginPath();
  if (!open) {
    if (horizontal) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + length);
    }
  } else if (horizontal) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + gapCenter - gap / 2, y);
    ctx.moveTo(x + gapCenter + gap / 2, y);
    ctx.lineTo(x + length, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + gapCenter - gap / 2);
    ctx.moveTo(x, y + gapCenter + gap / 2);
    ctx.lineTo(x, y + length);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, ph * 0.08);
  const step = pw * 1.7;
  for (let t = pw; t < length - pw; t += step) {
    if (gap > 0 && Math.abs(t - gapCenter) < gap / 2) continue;
    if (dir === "up") drawPicket(ctx, x + t - pw / 2, y - ph, pw, ph, dir);
    else if (dir === "down") drawPicket(ctx, x + t - pw / 2, y, pw, ph, dir);
    else if (dir === "left") drawPicket(ctx, x - ph, y + t - pw / 2, pw, ph, dir);
    else drawPicket(ctx, x, y + t - pw / 2, pw, ph, dir);
  }
  if (gap > 0) {
    const lift = ph * 0.25;
    if (horizontal) {
      drawPost(ctx, x + gapCenter - gap / 2, y + lift, pw, ph);
      drawPost(ctx, x + gapCenter + gap / 2, y + lift, pw, ph);
    } else {
      drawPost(ctx, x, y + gapCenter - gap / 2, pw, ph);
      drawPost(ctx, x, y + gapCenter + gap / 2, pw, ph);
    }
  }
}

function drawPicket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pw: number,
  ph: number,
  dir: "up" | "down" | "left" | "right",
) {
  ctx.beginPath();
  if (dir === "up") {
    ctx.moveTo(x, y + ph);
    ctx.lineTo(x, y + pw * 0.75);
    ctx.lineTo(x + pw / 2, y);
    ctx.lineTo(x + pw, y + pw * 0.75);
    ctx.lineTo(x + pw, y + ph);
  } else if (dir === "down") {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + ph - pw * 0.75);
    ctx.lineTo(x + pw / 2, y + ph);
    ctx.lineTo(x + pw, y + ph - pw * 0.75);
    ctx.lineTo(x + pw, y);
  } else if (dir === "left") {
    ctx.moveTo(x + ph, y);
    ctx.lineTo(x + ph - pw * 0.75, y);
    ctx.lineTo(x, y + pw / 2);
    ctx.lineTo(x + ph - pw * 0.75, y + pw);
    ctx.lineTo(x + ph, y + pw);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + pw * 0.75, y);
    ctx.lineTo(x + ph, y + pw / 2);
    ctx.lineTo(x + pw * 0.75, y + pw);
    ctx.lineTo(x, y + pw);
  }
  ctx.closePath();
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.stroke();
}

function drawPost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pw: number,
  ph: number,
) {
  const w = pw * 1.45;
  const h = ph * 1.2;
  ctx.fillStyle = WOOD;
  traceRound(ctx, x - w / 2, y - h, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = BERRY;
  ctx.beginPath();
  ctx.arc(x, y - h, w * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function fillGrass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  paintGrass(ctx, x, y, w, h);
  ctx.restore();
}

function paintGrass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const image = cachedImage(GRASS_SRC);
  if (image) {
    ctx.drawImage(image, x, y, w, h);
    return;
  }
  ctx.fillStyle = GRASS;
  ctx.fillRect(x, y, w, h);
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.85, y + r * 0.15, r * 0.75, 0, Math.PI * 2);
  ctx.arc(x - r * 0.7, y + r * 0.2, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  frame: { x: number; y: number; w: number; h: number },
) {
  const { x, y, w, h } = frame;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, w * 0.025);
  ctx.fillStyle = "rgba(36,50,74,0.13)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.96, w * 0.4, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BERRY;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h * 0.42);
  ctx.lineTo(x + w * 0.5, y + h * 0.1);
  ctx.lineTo(x + w * 0.94, y + h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PAPER;
  traceRound(ctx, x + w * 0.14, y + h * 0.38, w * 0.72, h * 0.54, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = WOOD_DARK;
  traceRound(ctx, x + w * 0.42, y + h * 0.64, w * 0.16, h * 0.28, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = SKY;
  traceRound(ctx, x + w * 0.22, y + h * 0.5, w * 0.14, h * 0.12, 3);
  ctx.fill();
  ctx.stroke();
  traceRound(ctx, x + w * 0.64, y + h * 0.5, w * 0.14, h * 0.12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlaceSign(
  ctx: CanvasRenderingContext2D,
  place: Place,
  frame: Box,
  canvasH: number,
  park: Box,
) {
  const sign = cachedImage(SIGN_SRC[place]);
  if (!sign) return;
  const { x, y, w, h } = frame;
  let sw = w * 0.94;
  let sh = sw * (sign.height / Math.max(1, sign.width));
  const maxH = Math.max(h * 0.9, 40);
  if (sh > maxH) {
    sh = maxH;
    sw = sh * (sign.width / Math.max(1, sign.height));
  }
  let sx = x + (w - sw) / 2;
  if (park.x > x + w * 0.4) sx = Math.min(sx, park.x - sw - 6);
  let sy = y + h * 0.86 - sh * 0.62;
  if (park.y > y + h * 0.45) sy = Math.min(sy, park.y - sh * 0.08);
  if (y > park.y + park.h * 0.35) sy = Math.max(sy, park.y + park.h - sh * 0.2);
  sy = Math.max(4, Math.min(sy, canvasH - sh - 4));
  ctx.drawImage(sign, sx, sy, sw, sh);
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: Sticker,
  canvasW: number,
  canvasH: number,
  selected: boolean,
) {
  const box = stickerBox(sticker);
  const pw = box.w * canvasW * sticker.scale;
  const ph = box.h * canvasW * sticker.scale;
  const cx = sticker.x * canvasW;
  const cy = sticker.y * canvasH;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((sticker.rotation * Math.PI) / 180);
  ctx.fillStyle = "rgba(36,50,74,0.12)";
  ctx.beginPath();
  ctx.ellipse(0, ph * 0.48, pw * 0.36, ph * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (sticker.flip) ctx.scale(-1, 1);
  if (sticker.src) {
    const image = cachedImage(sticker.src);
    if (image) ctx.drawImage(image, -pw / 2, -ph / 2, pw, ph);
    else {
      ctx.fillStyle = WHITE;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      traceRound(ctx, -pw / 2, -ph / 2, pw, ph, 8);
      ctx.fill();
      ctx.stroke();
    }
  } else if (sticker.kind !== "drawing") {
    drawProp(ctx, sticker.kind, -pw / 2, -ph / 2, pw, ph);
  }
  ctx.restore();
  if (selected) {
    ctx.strokeStyle = BERRY;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    traceRound(ctx, -pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    const knob = sizeKnobLocal(pw, ph);
    ctx.beginPath();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.arc(knob.x, knob.y, SIZE_KNOB, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = BERRY;
    ctx.arc(knob.x, knob.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawProp(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.045);
  if (kind === "tree") drawTree(ctx, x, y, w, h);
  else if (kind === "flower") drawFlower(ctx, x, y, w, h);
  else if (kind === "bush") drawBush(ctx, x, y, w, h);
  else if (kind === "bench") drawBench(ctx, x, y, w, h);
  else if (kind === "blanket") drawBlanket(ctx, x, y, w, h);
  else if (kind === "swing") drawSwing(ctx, x, y, w, h);
  else if (kind === "slide") drawSlide(ctx, x, y, w, h);
  else if (kind === "bin") drawBin(ctx, x, y, w, h);
  else if (kind === "kite") drawKite(ctx, x, y, w, h);
  else drawPond(ctx, x, y, w, h);
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = WOOD;
  traceRound(ctx, x + w * 0.4, y + h * 0.55, w * 0.2, h * 0.4, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = GRASS_DEEP;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.38, w * 0.28, 0, Math.PI * 2);
  ctx.arc(x + w * 0.32, y + h * 0.48, w * 0.22, 0, Math.PI * 2);
  ctx.arc(x + w * 0.68, y + h * 0.48, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = GRASS_DEEP;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.95);
  ctx.lineTo(x + w * 0.5, y + h * 0.45);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#f48fb1";
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(
      x + w * 0.5 + Math.cos(angle) * w * 0.18,
      y + h * 0.32 + Math.sin(angle) * h * 0.14,
      w * 0.14,
      h * 0.1,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.32, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = GRASS_DEEP;
  ctx.beginPath();
  ctx.arc(x + w * 0.32, y + h * 0.6, w * 0.24, 0, Math.PI * 2);
  ctx.arc(x + w * 0.58, y + h * 0.52, w * 0.28, 0, Math.PI * 2);
  ctx.arc(x + w * 0.74, y + h * 0.66, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = WOOD;
  traceRound(ctx, x + w * 0.08, y + h * 0.28, w * 0.84, h * 0.18, 3);
  ctx.fill();
  ctx.stroke();
  traceRound(ctx, x + w * 0.12, y + h * 0.5, w * 0.76, h * 0.16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x + w * 0.16, y + h * 0.66, w * 0.08, h * 0.28);
  ctx.fillRect(x + w * 0.76, y + h * 0.66, w * 0.08, h * 0.28);
  ctx.strokeRect(x + w * 0.16, y + h * 0.66, w * 0.08, h * 0.28);
  ctx.strokeRect(x + w * 0.76, y + h * 0.66, w * 0.08, h * 0.28);
}

function drawBlanket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = BERRY;
  traceRound(ctx, x + w * 0.06, y + h * 0.18, w * 0.88, h * 0.68, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SUN;
  ctx.fillRect(x + w * 0.06, y + h * 0.42, w * 0.88, h * 0.16);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x + w * 0.4, y + h * 0.18, w * 0.12, h * 0.68);
}

function drawSwing(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = BERRY;
  ctx.lineWidth = Math.max(3, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, y + h * 0.92);
  ctx.lineTo(x + w * 0.38, y + h * 0.12);
  ctx.lineTo(x + w * 0.62, y + h * 0.12);
  ctx.lineTo(x + w * 0.82, y + h * 0.92);
  ctx.moveTo(x + w * 0.28, y + h * 0.12);
  ctx.lineTo(x + w * 0.72, y + h * 0.12);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, w * 0.03);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y + h * 0.12);
  ctx.lineTo(x + w * 0.36, y + h * 0.62);
  ctx.moveTo(x + w * 0.6, y + h * 0.12);
  ctx.lineTo(x + w * 0.64, y + h * 0.62);
  ctx.stroke();
  ctx.fillStyle = WOOD;
  traceRound(ctx, x + w * 0.28, y + h * 0.6, w * 0.44, h * 0.1, 3);
  ctx.fill();
  ctx.stroke();
}

function drawSlide(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = Math.max(3, w * 0.045);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, y + h * 0.92);
  ctx.lineTo(x + w * 0.22, y + h * 0.28);
  ctx.lineTo(x + w * 0.42, y + h * 0.28);
  ctx.moveTo(x + w * 0.16, y + h * 0.48);
  ctx.lineTo(x + w * 0.3, y + h * 0.48);
  ctx.moveTo(x + w * 0.16, y + h * 0.66);
  ctx.lineTo(x + w * 0.3, y + h * 0.66);
  ctx.stroke();
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.36, y + h * 0.22);
  ctx.lineTo(x + w * 0.9, y + h * 0.72);
  ctx.lineTo(x + w * 0.78, y + h * 0.86);
  ctx.lineTo(x + w * 0.24, y + h * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, w * 0.035);
  ctx.stroke();
}

function drawBin(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = GRASS_DEEP;
  traceRound(ctx, x + w * 0.2, y + h * 0.28, w * 0.6, h * 0.62, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3d8f45";
  traceRound(ctx, x + w * 0.14, y + h * 0.18, w * 0.72, h * 0.16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.58, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawKite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.06);
  ctx.lineTo(x + w * 0.86, y + h * 0.36);
  ctx.lineTo(x + w * 0.5, y + h * 0.66);
  ctx.lineTo(x + w * 0.14, y + h * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.06);
  ctx.lineTo(x + w * 0.5, y + h * 0.66);
  ctx.moveTo(x + w * 0.14, y + h * 0.36);
  ctx.lineTo(x + w * 0.86, y + h * 0.36);
  ctx.stroke();
  ctx.strokeStyle = BERRY;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.66);
  ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.78, x + w * 0.48, y + h * 0.92);
  ctx.stroke();
  ctx.fillStyle = BERRY;
  ctx.beginPath();
  ctx.arc(x + w * 0.48, y + h * 0.92, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawPond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#7ec8f0";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.58, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.4, y + h * 0.55, w * 0.12, h * 0.06, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GRASS_DEEP;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.78, y + h * 0.42, w * 0.05, h * 0.16, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

export const SIZE_KNOB = 16;

export function sizeKnobLocal(pw: number, ph: number) {
  return { x: pw / 2 + 14, y: ph / 2 + 14 };
}

export function toLocal(
  sticker: Sticker,
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
) {
  const box = stickerBox(sticker);
  const pw = box.w * canvasW * sticker.scale;
  const ph = box.h * canvasW * sticker.scale;
  const cx = sticker.x * canvasW;
  const cy = sticker.y * canvasH;
  const angle = (-sticker.rotation * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    pw,
    ph,
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

export function hitSizeKnob(
  sticker: Sticker,
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
) {
  const local = toLocal(sticker, px, py, canvasW, canvasH);
  const knob = sizeKnobLocal(local.pw, local.ph);
  return Math.hypot(local.x - knob.x, local.y - knob.y) <= 30;
}

export function hitSticker(
  stickers: Sticker[],
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
): Sticker | null {
  for (let i = stickers.length - 1; i >= 0; i--) {
    const sticker = stickers[i];
    if (!sticker) continue;
    const box = stickerBox(sticker);
    const hw = (box.w * canvasW * sticker.scale) / 2 + 10;
    const hh = (box.h * canvasW * sticker.scale) / 2 + 10;
    const dx = px - sticker.x * canvasW;
    const dy = py - sticker.y * canvasH;
    const angle = (-sticker.rotation * Math.PI) / 180;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return sticker;
  }
  return null;
}
