import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { drawScene, ensureImage, hitSizeKnob, hitSticker, sceneSources, toLocal } from "./art";
import type { Draft } from "./model";
import { useDraft } from "./store";

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.6;

export function PropGlyph({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} className="pointer-events-none h-14 w-14 object-contain" />;
}

type Point = { x: number; y: number; w: number; h: number };

export function ParkCanvas({ draft }: { draft: Draft }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null);
  const sizing = useRef<{ id: string; pointerId: number; startDist: number; startScale: number } | null>(null);
  const pinch = useRef<{ id: string; startDist: number; startScale: number } | null>(null);
  const updateSticker = useDraft((state) => state.updateSticker);
  const selectSticker = useDraft((state) => state.selectSticker);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width < 2 || height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, width, height, {
        relation: draft.relation,
        place: draft.place,
        stickers: draft.stickers,
        selectedId: draft.locked ? null : draft.selectedId,
      });
    };
    const sources = [
      ...sceneSources(draft.place),
      ...draft.stickers.flatMap((sticker) => (sticker.src ? [sticker.src] : [])),
    ];
    void Promise.all(sources.map((src) => ensureImage(src))).then(paint);
    paint();
    const parent = canvas.parentElement;
    const observer = new ResizeObserver(paint);
    if (parent) observer.observe(parent);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [draft.relation, draft.place, draft.stickers, draft.selectedId, draft.locked]);

  function cssPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  }

  function fingerDistance() {
    const pts = [...pointers.current.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function beginPinch() {
    const pts = [...pointers.current.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return;
    const state = useDraft.getState();
    if (state.locked) return;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const hit =
      hitSticker(state.stickers, midX, midY, a.w, a.h) ??
      hitSticker(state.stickers, a.x, a.y, a.w, a.h) ??
      hitSticker(state.stickers, b.x, b.y, b.w, b.h) ??
      state.stickers.find((sticker) => sticker.id === state.selectedId) ??
      null;
    if (!hit) return;
    selectSticker(hit.id);
    pinch.current = {
      id: hit.id,
      startDist: Math.max(12, fingerDistance()),
      startScale: hit.scale,
    };
    drag.current = null;
    sizing.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Your park"
      tabIndex={0}
      onPointerDown={(event) => {
        if (draft.locked) return;
        const point = cssPoint(event);
        if (!point) return;
        pointers.current.set(event.pointerId, point);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointers.current.size >= 2) {
          beginPinch();
          return;
        }
        const state = useDraft.getState();
        const selected = state.stickers.find((sticker) => sticker.id === state.selectedId) ?? null;
        if (selected && hitSizeKnob(selected, point.x, point.y, point.w, point.h)) {
          const local = toLocal(selected, point.x, point.y, point.w, point.h);
          sizing.current = {
            id: selected.id,
            pointerId: event.pointerId,
            startDist: Math.max(16, Math.hypot(local.x, local.y)),
            startScale: selected.scale,
          };
          return;
        }
        const hit = hitSticker(state.stickers, point.x, point.y, point.w, point.h);
        if (!hit) {
          selectSticker(null);
          return;
        }
        selectSticker(hit.id);
        drag.current = {
          id: hit.id,
          pointerId: event.pointerId,
          dx: point.x - hit.x * point.w,
          dy: point.y - hit.y * point.h,
        };
      }}
      onPointerMove={(event) => {
        const point = cssPoint(event);
        if (!point || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, point);
        if (pinch.current && pointers.current.size >= 2) {
          const dist = Math.max(12, fingerDistance());
          const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.startScale * (dist / pinch.current.startDist)));
          updateSticker(pinch.current.id, { scale });
          return;
        }
        const sizingNow = sizing.current;
        if (sizingNow && sizingNow.pointerId === event.pointerId) {
          const sticker = useDraft.getState().stickers.find((item) => item.id === sizingNow.id);
          if (!sticker) return;
          const local = toLocal(sticker, point.x, point.y, point.w, point.h);
          const dist = Math.max(16, Math.hypot(local.x, local.y));
          const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, sizingNow.startScale * (dist / sizingNow.startDist)));
          updateSticker(sizingNow.id, { scale });
          return;
        }
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const x = Math.min(0.96, Math.max(0.04, (point.x - current.dx) / point.w));
        const y = Math.min(0.96, Math.max(0.04, (point.y - current.dy) / point.h));
        updateSticker(current.id, { x, y });
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
        if (sizing.current?.pointerId === event.pointerId) sizing.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
        if (sizing.current?.pointerId === event.pointerId) sizing.current = null;
      }}
      onKeyDown={(event) => {
        if (draft.locked || !draft.selectedId) return;
        const sticker = draft.stickers.find((item) => item.id === draft.selectedId);
        if (!sticker) return;
        const step = event.shiftKey ? 0.04 : 0.02;
        if (event.key === "ArrowLeft") updateSticker(sticker.id, { x: Math.max(0.04, sticker.x - step) });
        if (event.key === "ArrowRight") updateSticker(sticker.id, { x: Math.min(0.96, sticker.x + step) });
        if (event.key === "ArrowUp") updateSticker(sticker.id, { y: Math.max(0.04, sticker.y - step) });
        if (event.key === "ArrowDown") updateSticker(sticker.id, { y: Math.min(0.96, sticker.y + step) });
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          useDraft.getState().removeSticker(sticker.id);
        }
      }}
    />
  );
}
