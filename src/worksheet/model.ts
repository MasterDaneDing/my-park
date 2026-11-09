export const TEACHER_PASSWORD = "patpat";

export const CLASSES = ["2A", "2B", "2C", "2D"] as const;
export type ClassName = (typeof CLASSES)[number];

export const RELATIONS = ["in front of", "next to", "behind"] as const;
export type Relation = (typeof RELATIONS)[number];

export const PLACES = [
  "cinema",
  "clinic",
  "fire station",
  "police station",
  "restaurant",
  "post office",
  "bank",
  "supermarket",
] as const;
export type Place = (typeof PLACES)[number];

export type { ParkGroup, PropKind } from "./catalog";
export { CATALOG, PARK_GROUPS, catalogById } from "./catalog";

export type Sticker = {
  id: string;
  kind: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** Faces the other way. Old stickers without this face right. */
  flip?: boolean;
  src?: string;
  aspect?: number;
};

export type LastSave = "drive" | "download" | null;

export type Draft = {
  step: number;
  name: string;
  className: ClassName | "";
  title: string;
  kind: string;
  relation: Relation;
  place: Place;
  can: string;
  should: string;
  mustNot: string;
  stickers: Sticker[];
  selectedId: string | null;
  locked: boolean;
  lastSave: LastSave;
};

export const WRITING_STEPS = 7;
export const FINAL_STEP = 7;

export const initialDraft: Draft = {
  step: 0,
  name: "",
  className: "",
  title: "",
  kind: "",
  relation: "in front of",
  place: "police station",
  can: "",
  should: "",
  mustNot: "",
  stickers: [],
  selectedId: null,
  locked: false,
  lastSave: null,
};

export function posterTitle(draft: Draft): string {
  const title = draft.title.trim();
  return title ? `${title} Park!` : "My Park!";
}

export function posterSentences(draft: Draft): string[] {
  const kind = draft.kind.trim() || "……";
  const can = draft.can.trim() || "……";
  const should = draft.should.trim() || "……";
  const mustNot = draft.mustNot.trim() || "……";
  return [
    `It is ${kind} Park.`,
    `It is ${draft.relation} the ${draft.place}.`,
    `You can ${can} in the park.`,
    `We should ${should}.`,
    `We must not ${mustNot}.`,
  ];
}

export function pdfFilename(draft: Draft): string {
  const name = (draft.name.trim() || "Pupil")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const cls = draft.className || "Class";
  return `${name} ${cls} - Park.pdf`;
}

export function stepReady(draft: Draft): boolean {
  switch (draft.step) {
    case 0:
      return draft.name.trim().length > 0 && draft.className !== "";
    case 1:
      return draft.title.trim().length > 0;
    case 2:
      return draft.kind.trim().length > 0;
    case 3:
      return true;
    case 4:
      return draft.can.trim().length > 0;
    case 5:
      return draft.should.trim().length > 0;
    case 6:
      return draft.mustNot.trim().length > 0;
    default:
      return true;
  }
}

const STORAGE_KEY = "my-park-draft-v1";

export function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const step = Number(parsed.step);
    return {
      ...initialDraft,
      ...parsed,
      step: Number.isFinite(step) ? Math.min(FINAL_STEP, Math.max(0, step)) : 0,
      stickers: Array.isArray(parsed.stickers) ? parsed.stickers : [],
      className: (CLASSES as readonly string[]).includes(parsed.className ?? "")
        ? (parsed.className as ClassName)
        : "",
    };
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft) {
  const saved: Draft = {
    step: draft.step,
    name: draft.name,
    className: draft.className,
    title: draft.title,
    kind: draft.kind,
    relation: draft.relation,
    place: draft.place,
    can: draft.can,
    should: draft.should,
    mustNot: draft.mustNot,
    stickers: draft.stickers,
    selectedId: draft.selectedId,
    locked: draft.locked,
    lastSave: draft.lastSave,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
