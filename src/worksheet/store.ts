import { useEffect, useState } from "react";
import { create } from "zustand";
import { catalogById, type PropKind } from "./catalog";
import {
  type Draft,
  type Relation,
  type Sticker,
  clearDraft,
  initialDraft,
  readDraft,
  writeDraft,
} from "./model";
import { dropPoint } from "./art";

type Actions = {
  patch: (partial: Partial<Draft>) => void;
  addProp: (kind: PropKind) => void;
  addDrawing: (src: string, aspect: number) => void;
  updateSticker: (id: string, partial: Partial<Sticker>) => void;
  selectSticker: (id: string | null) => void;
  removeSticker: (id: string) => void;
  lock: (mode: "drive" | "download") => void;
  unlock: () => void;
  resetPupil: () => void;
};

function bringToFront(stickers: Sticker[], id: string): Sticker[] {
  const hit = stickers.find((sticker) => sticker.id === id);
  if (!hit) return stickers;
  return [...stickers.filter((sticker) => sticker.id !== id), hit];
}

type Store = Draft & Actions;

export const useDraft = create<Store>((set, get) => ({
  ...initialDraft,
  patch: (partial) => set(partial),
  addProp: (kind) => {
    if (get().locked) return;
    const item = catalogById(kind);
    if (!item) return;
    const sticker: Sticker = {
      id: crypto.randomUUID(),
      kind: item.id,
      ...dropPoint(get().relation, get().stickers.length),
      scale: 1,
      rotation: 0,
      flip: false,
      src: item.src,
      aspect: item.aspect,
    };
    set({ stickers: [...get().stickers, sticker], selectedId: sticker.id });
  },
  addDrawing: (src, aspect) => {
    if (get().locked) return;
    const sticker: Sticker = {
      id: crypto.randomUUID(),
      kind: "drawing",
      ...dropPoint(get().relation, get().stickers.length),
      scale: 1,
      rotation: 0,
      flip: false,
      src,
      aspect,
    };
    set({ stickers: [...get().stickers, sticker], selectedId: sticker.id });
  },
  updateSticker: (id, partial) =>
    set({
      stickers: get().stickers.map((sticker) =>
        sticker.id === id ? { ...sticker, ...partial } : sticker,
      ),
    }),
  selectSticker: (id) =>
    set({
      selectedId: id,
      stickers: id ? bringToFront(get().stickers, id) : get().stickers,
    }),
  removeSticker: (id) =>
    set({
      stickers: get().stickers.filter((sticker) => sticker.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),
  lock: (mode) => set({ locked: true, selectedId: null, lastSave: mode }),
  unlock: () => set({ locked: false, lastSave: null }),
  resetPupil: () => {
    clearDraft();
    set({ ...initialDraft });
  },
}));

export type Sheet = Store;

export function useDraftPersistence() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readDraft();
    if (stored) useDraft.setState(stored);
    setReady(true);
  }, []);

  const snapshot = useDraft((state) =>
    JSON.stringify({
      step: state.step,
      name: state.name,
      className: state.className,
      title: state.title,
      kind: state.kind,
      relation: state.relation,
      place: state.place,
      can: state.can,
      should: state.should,
      mustNot: state.mustNot,
      stickers: state.stickers,
      selectedId: state.selectedId,
      locked: state.locked,
      lastSave: state.lastSave,
    }),
  );

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      writeDraft(JSON.parse(snapshot) as Draft);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [ready, snapshot]);

  return ready;
}

export function grassHint(relation: Relation): string {
  if (relation === "in front of") return "The park sits in front of the building.";
  if (relation === "behind") return "The park sits behind the building.";
  return "The park sits next to the building.";
}
