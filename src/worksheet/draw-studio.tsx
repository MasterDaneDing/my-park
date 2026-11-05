import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Paintbrush, PenLine, Undo2, X } from "lucide-react";

type Tool = "pen" | "brush" | "erase";
type Point = { x: number; y: number };
type Ellipse = { cx: number; cy: number; rx: number; ry: number };
type Mark =
  | { kind: "path"; tool: Tool; color: string; points: Point[] }
  | { kind: "shape"; color: string; points: Point[]; ellipse: Ellipse | null };

const CRAYONS = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "black", label: "Black", hex: "#241c16" },
  { id: "red", label: "Red", hex: "#d7263d" },
  { id: "orange", label: "Orange", hex: "#f08a24" },
  { id: "yellow", label: "Yellow", hex: "#ffd15c" },
  { id: "green", label: "Green", hex: "#67b84a" },
  { id: "blue", label: "Blue", hex: "#2f86c4" },
  { id: "purple", label: "Purple", hex: "#6d4ca3" },
  { id: "pink", label: "Pink", hex: "#f48fb1" },
  { id: "brown", label: "Brown", hex: "#8d5a3c" },
] as const;

const INK = "#241c16";
const GRASS = "#7ed04f";

function trace(ctx: CanvasRenderingContext2D, points: Point[]) {
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) ctx.lineTo(point.x, point.y);
  }
}

function pathLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

function recogniseCircle(points: Point[]): Ellipse | null {
  if (points.length < 8) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw < 36 || bh < 36) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = bw / 2;
  const ry = bh / 2;
  let sum = 0;
  let sum2 = 0;
  const angles: number[] = [];
  for (const point of points) {
    const radius = Math.hypot((point.x - cx) / rx, (point.y - cy) / ry);
    sum += radius;
    sum2 += radius * radius;
    angles.push(Math.atan2(point.y - cy, point.x - cx));
  }
  const mean = sum / points.length;
  const std = Math.sqrt(Math.max(0, sum2 / points.length - mean * mean));
  if (mean < 0.55 || mean > 1.45 || std > 0.34) return null;
  angles.sort((a, b) => a - b);
  let maxGap = angles[0]! + Math.PI * 2 - angles[angles.length - 1]!;
  for (let i = 1; i < angles.length; i++) {
    const gap = angles[i]! - angles[i - 1]!;
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap > 1.5) return null;
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return null;
  const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const length = pathLength(points);
  if (length < circumference * 0.72 || length > circumference * 2.5) return null;
  if (Math.hypot(start.x - end.x, start.y - end.y) > Math.max(rx, ry) * 0.7) return null;
  const aspect = bw / bh;
  const cornerReach = 0.16 * Math.max(bw, bh);
  let corners = 0;
  for (const [x, y] of [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ]) {
    if (points.some((point) => Math.hypot(point.x - x, point.y - y) < cornerReach)) corners += 1;
  }
  if (corners >= 3) return null;
  if (aspect > 0.78 && aspect < 1.28) {
    const radius = (bw + bh) / 4;
    return { cx, cy, rx: radius, ry: radius };
  }
  return { cx, cy, rx, ry };
}

function isClosed(points: Point[]) {
  if (points.length < 8) return false;
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return false;
  const length = pathLength(points);
  if (length < 48) return false;
  return Math.hypot(start.x - end.x, start.y - end.y) < Math.max(28, length * 0.2);
}

function finishPen(points: Point[], color: string): Mark {
  const ellipse = recogniseCircle(points);
  if (ellipse) return { kind: "shape", color, points, ellipse };
  if (isClosed(points)) return { kind: "shape", color, points, ellipse: null };
  return { kind: "path", tool: "pen", color, points };
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (mark.kind === "path" && mark.tool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 28;
    trace(ctx, mark.points);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (mark.kind === "shape" && mark.ellipse) {
    const { cx, cy, rx, ry } = mark.ellipse;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = mark.color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(6, Math.min(rx, ry) * 0.09);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (mark.kind === "shape") {
    trace(ctx, mark.points);
    ctx.closePath();
    ctx.fillStyle = mark.color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const { points, tool, color } = mark;
  if (!points.length) {
    ctx.restore();
    return;
  }
  if (points.length === 1) {
    const point = points[0];
    if (!point) {
      ctx.restore();
      return;
    }
    const radius = tool === "pen" ? 14 : 10;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = tool === "pen" ? color : color;
    ctx.fill();
    if (tool === "pen") {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (tool === "pen") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 18;
    trace(ctx, points);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    trace(ctx, points);
    ctx.stroke();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    trace(ctx, points);
    ctx.stroke();
  }
  ctx.restore();
}

function trimInk(source: HTMLCanvasElement): { src: string; aspect: number } | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha > 12) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  const pad = 12;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const sw = maxX - minX + 1;
  const sh = maxY - minY + 1;
  const scale = Math.min(1, 640 / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.drawImage(source, minX, minY, sw, sh, 0, 0, out.width, out.height);
  return { src: out.toDataURL("image/png"), aspect: out.height / out.width };
}

export function DrawStudio({
  onClose,
  onPlace,
}: {
  onClose: () => void;
  onPlace: (src: string, aspect: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const ink = useRef<HTMLCanvasElement | null>(null);
  const marks = useRef<Mark[]>([]);
  const live = useRef<Mark | null>(null);
  const size = useRef({ cssW: 0, cssH: 0, dpr: 1 });
  const [tool, setTool] = useState<Tool>("pen");
  const [crayon, setCrayon] = useState("white");
  const [empty, setEmpty] = useState(true);
  const toolRef = useRef(tool);
  const colorRef = useRef("#ffffff");
  toolRef.current = tool;
  colorRef.current = CRAYONS.find((item) => item.id === crayon)?.hex ?? "#ffffff";

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function paint() {
    const box = frame.current;
    const shown = view.current;
    if (!box || !shown) return;
    const cssW = box.clientWidth;
    const cssH = box.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!ink.current) ink.current = document.createElement("canvas");
    const buffer = ink.current;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (buffer.width !== bw || buffer.height !== bh) {
      buffer.width = bw;
      buffer.height = bh;
    }
    if (shown.width !== bw || shown.height !== bh) {
      shown.width = bw;
      shown.height = bh;
    }
    size.current = { cssW, cssH, dpr };
    const bufferCtx = buffer.getContext("2d");
    const shownCtx = shown.getContext("2d");
    if (!bufferCtx || !shownCtx) return;
    bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bufferCtx.clearRect(0, 0, cssW, cssH);
    for (const mark of marks.current) drawMark(bufferCtx, mark);
    if (live.current) drawMark(bufferCtx, live.current);
    shownCtx.setTransform(1, 0, 0, 1, 0, 0);
    shownCtx.fillStyle = GRASS;
    shownCtx.fillRect(0, 0, shown.width, shown.height);
    shownCtx.drawImage(buffer, 0, 0);
  }

  useEffect(() => {
    paint();
    const box = frame.current;
    if (!box) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  function localPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = view.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pushPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!live.current || live.current.kind !== "path") return;
    const native = event.nativeEvent;
    const extras = native.getCoalescedEvents?.() ?? [];
    const events = extras.length ? extras : [native];
    for (const item of events) {
      const canvas = view.current;
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      live.current.points.push({ x: item.clientX - rect.left, y: item.clientY - rect.top });
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-paper p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold text-ink">Draw</h2>
        <button type="button" className="btn bg-paper text-ink" onClick={onClose}>
          <X aria-hidden />
          Close
        </button>
      </div>
      <p className="mb-2 font-display font-bold text-muted">
        {tool === "pen"
          ? "Pen draws a black outline. A circle fills with the colour you pick. White makes a white circle."
          : tool === "brush"
            ? "Brush: draw freely in the colour you pick."
            : "Rubber: rub out a mistake."}
      </p>
      <div ref={frame} className="relative min-h-48 flex-1 overflow-hidden rounded-3xl border-4 border-ink">
        <canvas
          ref={view}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Drawing paper"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            live.current = {
              kind: "path",
              tool: toolRef.current,
              color: colorRef.current,
              points: [localPoint(event)],
            };
            paint();
          }}
          onPointerMove={(event) => {
            if (!live.current) return;
            pushPoint(event);
            paint();
          }}
          onPointerUp={() => {
            const stroke = live.current;
            live.current = null;
            if (stroke && stroke.kind === "path" && stroke.points.length) {
              const done =
                stroke.tool === "pen" ? finishPen(stroke.points, stroke.color) : stroke;
              marks.current = [...marks.current, done];
              setEmpty(false);
            }
            paint();
          }}
          onPointerCancel={() => {
            live.current = null;
            paint();
          }}
        />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={`btn shrink-0 ${tool === "pen" ? "bg-sun text-ink" : "bg-paper text-ink"}`}
          onClick={() => setTool("pen")}
          aria-pressed={tool === "pen"}
        >
          <PenLine aria-hidden />
          Pen
        </button>
        <button
          type="button"
          className={`btn shrink-0 ${tool === "brush" ? "bg-sun text-ink" : "bg-paper text-ink"}`}
          onClick={() => setTool("brush")}
          aria-pressed={tool === "brush"}
        >
          <Paintbrush aria-hidden />
          Brush
        </button>
        <button
          type="button"
          className={`btn shrink-0 ${tool === "erase" ? "bg-sun text-ink" : "bg-paper text-ink"}`}
          onClick={() => setTool("erase")}
          aria-pressed={tool === "erase"}
        >
          <Eraser aria-hidden />
          Rubber
        </button>
        <button
          type="button"
          className="btn shrink-0 bg-paper text-ink"
          onClick={() => {
            marks.current = marks.current.slice(0, -1);
            setEmpty(marks.current.length === 0);
            paint();
          }}
        >
          <Undo2 aria-hidden />
          Undo
        </button>
        <button
          type="button"
          className="btn shrink-0 bg-berry text-paper"
          disabled={empty}
          onClick={() => {
            const trimmed = ink.current ? trimInk(ink.current) : null;
            if (!trimmed) return;
            onPlace(trimmed.src, trimmed.aspect);
          }}
        >
          Put it in the park
        </button>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Colours">
        {CRAYONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={crayon === item.id}
            className={`size-11 shrink-0 rounded-full border-4 ${crayon === item.id ? "border-berry" : "border-ink"}`}
            style={{ background: item.hex }}
            onClick={() => setCrayon(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
