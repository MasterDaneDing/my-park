import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, FlipHorizontal2, Minus, Plus, RotateCw, Trash2 } from "lucide-react";
import { saveParkPdf } from "@/lib/save-park";
import { loadStoredFont } from "./fonts";
import {
  CATALOG,
  CLASSES,
  FINAL_STEP,
  PARK_GROUPS,
  PLACES,
  RELATIONS,
  TEACHER_PASSWORD,
  WRITING_STEPS,
  pdfFilename,
  posterSentences,
  posterTitle,
  stepReady,
  type ClassName,
  type Draft,
  type ParkGroup,
} from "./model";
import { DrawStudio } from "./draw-studio";
import { ParkCanvas, PropGlyph } from "./park-canvas";
import { readScriptUrl } from "./script";
import { grassHint, useDraft, useDraftPersistence, type Sheet } from "./store";
import { TeacherButton, TeacherSheet } from "./teacher";
import { Wheel } from "./wheels";

const CARD = ["bg-blush", "bg-sun", "bg-sky", "bg-sun", "bg-blush", "bg-sky", "bg-sun"] as const;
const DOT = ["bg-berry", "bg-sky-deep", "bg-grass-deep", "bg-crayon-purple", "bg-crayon-pink"] as const;

export function Worksheet() {
  useDraftPersistence();
  const draft = useDraft();
  const [teacher, setTeacher] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveToDrive = useServerFn(saveParkPdf);

  useEffect(() => {
    void loadStoredFont();
  }, []);

  function goNext() {
    if (!stepReady(draft)) {
      setNudge(true);
      if (draft.step === 0 && draft.name.trim() && !draft.className) setHint("Select your class.");
      else setHint("Write on the line first.");
      window.setTimeout(() => setNudge(false), 320);
      return;
    }
    setHint("");
    draft.patch({ step: Math.min(FINAL_STEP, draft.step + 1) });
  }

  async function onSave() {
    if (draft.locked || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const pdf = await import("./pdf");
      const built = await pdf.buildWorksheetPdf(draft);
      const scriptUrl = readScriptUrl();
      if (!scriptUrl) {
        pdf.downloadBlob(built.blob, built.filename);
        draft.lock("download");
        return;
      }
      const pdfBase64 = await pdf.blobToBase64(built.blob);
      const result = await saveToDrive({
        data: {
          scriptUrl,
          filename: built.filename,
          pdfBase64,
          password: TEACHER_PASSWORD,
        },
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      draft.lock("drive");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const selected = draft.stickers.find((sticker) => sticker.id === draft.selectedId) ?? null;

  return (
    <div className="safe-pad min-h-dvh">
      <main className="sheet mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col gap-4 rounded-3xl border-4 border-ink bg-paper p-4 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm font-extrabold tracking-wide text-sky-deep uppercase">
              Worksheet 6
            </p>
            <h1 className="font-display text-4xl font-extrabold text-balance text-berry">My Park</h1>
          </div>
          <TeacherButton onClick={() => setTeacher(true)} />
        </header>

        {draft.step < FINAL_STEP ? (
          <>
            <p className="font-display font-extrabold text-muted">
              Screen {draft.step + 1} of {WRITING_STEPS}
            </p>
            <div className="flex gap-2" aria-hidden>
              {Array.from({ length: WRITING_STEPS }, (_, index) => (
                <span
                  key={index}
                  className={clsx("h-2 flex-1 rounded-full", index <= draft.step ? "bg-berry" : "bg-line")}
                />
              ))}
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                goNext();
              }}
            >
              <div
                className={clsx(
                  "card-pop flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto rounded-3xl border-4 border-ink p-5 sm:p-8",
                  CARD[draft.step],
                  nudge && "nudge",
                )}
              >
                <StepBody draft={draft} />
                {hint ? (
                  <p className="text-center font-display text-lg font-extrabold text-berry" role="status">
                    {hint}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn bg-paper text-ink"
                  disabled={draft.step === 0}
                  onClick={() => draft.patch({ step: draft.step - 1 })}
                >
                  <ChevronLeft aria-hidden />
                  Back
                </button>
                <button type="submit" className="btn bg-berry text-xl text-paper">
                  {draft.step === WRITING_STEPS - 1 ? "Make my park" : "Next"}
                  <ChevronRight aria-hidden />
                </button>
              </div>
            </form>
          </>
        ) : (
          <FinalBoard
            draft={draft}
            selectedScale={selected?.scale ?? 1}
            selectedRotation={selected?.rotation ?? 0}
            saving={saving}
            saveError={saveError}
            onDraw={() => setDrawing(true)}
            onSave={() => void onSave()}
          />
        )}
      </main>
      {teacher ? <TeacherSheet onClose={() => setTeacher(false)} /> : null}
      {drawing ? (
        <DrawStudio
          onClose={() => setDrawing(false)}
          onPlace={(src, aspect) => {
            draft.addDrawing(src, aspect);
            setDrawing(false);
          }}
        />
      ) : null}
    </div>
  );
}

function StepBody({ draft }: { draft: Sheet }) {
  const patch = draft.patch;
  if (draft.step === 0) {
    return (
      <>
        <label className="font-display text-3xl font-extrabold text-ink" htmlFor="park-blank">
          Write your name
        </label>
        <Blank
          id="park-blank"
          label="Your name"
          value={draft.name}
          capitalize="words"
          onChange={(name) => patch({ name })}
        />
        <p className="text-center font-display text-2xl font-extrabold">Then select your class</p>
        <div className="flex flex-wrap justify-center gap-3" role="radiogroup" aria-label="Class">
          {CLASSES.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              className={clsx(
                "btn min-h-16 min-w-24 select-none text-3xl",
                draft.className === name ? "bg-sun text-ink ring-4 ring-berry" : "bg-paper text-ink",
              )}
              aria-checked={draft.className === name}
              onPointerDown={(event) => {
                if (event.pointerType === "touch") event.preventDefault();
                patch({ className: name as ClassName });
              }}
              onClick={() => patch({ className: name as ClassName })}
            >
              {name}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (draft.step === 1) {
    return (
      <>
        <label className="sr-only" htmlFor="park-blank">
          Park name
        </label>
        <Blank
          id="park-blank"
          label="Park name"
          value={draft.title}
          capitalize="words"
          onChange={(title) => patch({ title })}
        />
        <p className="text-center font-display text-5xl font-extrabold text-berry">Park!</p>
      </>
    );
  }
  if (draft.step === 2) {
    return (
      <>
        <p className="text-center font-display text-3xl font-extrabold">It is</p>
        <label className="sr-only" htmlFor="park-blank">
          Kind of park
        </label>
        <Blank
          id="park-blank"
          label="Kind of park"
          value={draft.kind}
          capitalize="words"
          onChange={(kind) => patch({ kind })}
        />
        <p className="text-center font-display text-4xl font-extrabold">Park.</p>
        {draft.title.trim() ? (
          <p className="text-center font-display font-bold text-muted">
            You wrote {draft.title.trim()} on the last screen.
          </p>
        ) : null}
      </>
    );
  }
  if (draft.step === 3) {
    return (
      <>
        <p className="text-center font-display text-3xl font-extrabold">It is</p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Wheel
            label="Where"
            options={RELATIONS}
            value={draft.relation}
            onChange={(relation) => {
              if (relation === "in front of" || relation === "next to" || relation === "behind") {
                patch({ relation });
              }
            }}
          />
          <p className="text-center font-display text-3xl font-extrabold">the</p>
          <Wheel
            label="Building"
            options={PLACES}
            value={draft.place}
            onChange={(place) => {
              if ((PLACES as readonly string[]).includes(place)) {
                patch({ place: place as Draft["place"] });
              }
            }}
          />
        </div>
        <p className="text-center font-hand text-3xl text-ink">
          It is {draft.relation} the {draft.place}.
        </p>
        <p className="text-center font-display font-bold text-muted">Swipe the wheels.</p>
      </>
    );
  }
  if (draft.step === 4) {
    return (
      <>
        <p className="text-center font-display text-3xl font-extrabold">You can</p>
        <label className="sr-only" htmlFor="park-blank">
          What you can do
        </label>
        <Blank id="park-blank" label="What you can do" value={draft.can} onChange={(can) => patch({ can })} />
        <p className="text-center font-display text-3xl font-extrabold">in the park.</p>
      </>
    );
  }
  if (draft.step === 5) {
    return (
      <>
        <label className="font-display text-3xl font-extrabold" htmlFor="park-blank">
          We should
        </label>
        <Blank id="park-blank" label="What we should do" value={draft.should} onChange={(should) => patch({ should })} />
      </>
    );
  }
  return (
    <>
      <label className="font-display text-3xl font-extrabold" htmlFor="park-blank">
        We must not
      </label>
      <Blank
        id="park-blank"
        label="What we must not do"
        value={draft.mustNot}
        onChange={(mustNot) => patch({ mustNot })}
      />
    </>
  );
}

function Blank({
  id,
  label,
  value,
  onChange,
  capitalize = "none",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  capitalize?: "none" | "words";
}) {
  return (
    <input
      id={id}
      aria-label={label}
      className="blank"
      value={value}
      placeholder="········"
      maxLength={90}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      autoCapitalize={capitalize}
      enterKeyHint="next"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FinalBoard({
  draft,
  selectedScale,
  selectedRotation,
  saving,
  saveError,
  onDraw,
  onSave,
}: {
  draft: Sheet;
  selectedScale: number;
  selectedRotation: number;
  saving: boolean;
  saveError: string;
  onDraw: () => void;
  onSave: () => void;
}) {
  const sentences = posterSentences(draft);
  const filename = pdfFilename(draft);
  const [group, setGroup] = useState<ParkGroup>("Play");
  const items = CATALOG.filter((item) => item.group === group);
  const facing = draft.stickers.find((sticker) => sticker.id === draft.selectedId);
  return (
    <div className="flex flex-col gap-4">
      <div className="poster">
        <section className="min-w-0">
          <h2 className="font-display text-4xl font-extrabold text-balance text-berry">{posterTitle(draft)}</h2>
          <p className="mt-2 font-hand text-2xl">
            Name: {draft.name.trim() || "……"}
            <span className="inline-block w-6" />
            Class: {draft.className || "……"}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {sentences.map((sentence, index) => (
              <li key={sentence} className="flex items-start gap-3 border-b-2 border-line pb-2">
                <span className={clsx("mt-2 size-4 shrink-0 rounded-full", DOT[index])} aria-hidden />
                <span className="font-hand text-2xl leading-snug">{sentence}</span>
              </li>
            ))}
          </ul>
          {!draft.locked ? (
            <button type="button" className="btn mt-3 bg-paper text-ink" onClick={() => draft.patch({ step: 0 })}>
              Edit writing
            </button>
          ) : null}
        </section>
        <section className="min-w-0">
          <div className="park-frame relative overflow-hidden rounded-3xl border-4 border-ink bg-grass">
            <ParkCanvas draft={draft} />
          </div>
          <p className="mt-2 font-display font-bold text-muted">
            {draft.locked
              ? grassHint(draft.relation)
              : "Drag a picture. Pinch it, or pull the little circle, to change the size."}
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {PARK_GROUPS.map((name) => (
              <button
                key={name}
                type="button"
                className={clsx("btn shrink-0 px-4", group === name ? "bg-sun text-ink" : "bg-paper text-ink")}
                aria-pressed={group === name}
                onClick={() => setGroup(name)}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              className="btn shrink-0 bg-berry text-paper"
              disabled={draft.locked}
              onClick={onDraw}
            >
              Draw
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.map((prop) => (
              <button
                key={prop.id}
                type="button"
                className="chip flex w-20 shrink-0 flex-col items-center px-1 py-2"
                disabled={draft.locked}
                onClick={() => draft.addProp(prop.id)}
              >
                <PropGlyph src={prop.src} />
                <span className="font-display text-sm font-extrabold">{prop.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn bg-paper text-ink"
              disabled={draft.locked || !draft.selectedId}
              onClick={() =>
                draft.selectedId &&
                draft.updateSticker(draft.selectedId, { scale: Math.min(2.6, selectedScale * 1.12) })
              }
            >
              <Plus aria-hidden />
              Bigger
            </button>
            <button
              type="button"
              className="btn bg-paper text-ink"
              disabled={draft.locked || !draft.selectedId}
              onClick={() =>
                draft.selectedId &&
                draft.updateSticker(draft.selectedId, { scale: Math.max(0.4, selectedScale / 1.12) })
              }
            >
              <Minus aria-hidden />
              Smaller
            </button>
            <button
              type="button"
              className="btn bg-paper text-ink"
              disabled={draft.locked || !draft.selectedId}
              onClick={() =>
                draft.selectedId &&
                draft.updateSticker(draft.selectedId, { rotation: (selectedRotation + 15) % 360 })
              }
            >
              <RotateCw aria-hidden />
              Turn
            </button>
            <button
              type="button"
              className={clsx("btn text-ink", facing?.flip ? "bg-sun" : "bg-paper")}
              disabled={draft.locked || !draft.selectedId}
              aria-pressed={Boolean(facing?.flip)}
              onClick={() =>
                draft.selectedId &&
                draft.updateSticker(draft.selectedId, { flip: !facing?.flip })
              }
            >
              <FlipHorizontal2 aria-hidden />
              Other way
            </button>
            <button
              type="button"
              className="btn bg-paper text-ink"
              disabled={draft.locked || !draft.selectedId}
              onClick={() => draft.selectedId && draft.removeSticker(draft.selectedId)}
            >
              <Trash2 aria-hidden />
              Remove
            </button>
          </div>
        </section>
      </div>
      <div className="flex flex-col items-center gap-2 border-t-4 border-line pt-4">
        <button
          type="button"
          className="btn bg-berry px-10 text-xl text-paper"
          disabled={draft.locked || saving}
          onClick={onSave}
        >
          {draft.locked ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
        <p className="text-center font-display font-bold text-muted">{filename}</p>
        {draft.lastSave === "drive" ? (
          <p className="text-center font-display font-bold" role="status">
            Sent to Google Drive. Ask your teacher if you need to change it.
          </p>
        ) : null}
        {draft.lastSave === "download" ? (
          <p className="max-w-xl text-center font-display font-bold" role="status">
            Downloaded onto this iPad. Google Drive is not switched on yet. Your teacher can add it, then unlock
            one more save.
          </p>
        ) : null}
        {saveError ? (
          <p className="max-w-xl text-center font-display font-bold text-berry" role="alert">
            {saveError}
          </p>
        ) : null}
        {!draft.locked && !draft.lastSave ? (
          <p className="text-center font-display text-muted">
            Tap pictures to put them in the park, or draw your own.
          </p>
        ) : null}
      </div>
    </div>
  );
}
