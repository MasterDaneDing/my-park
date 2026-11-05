import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, X } from "lucide-react";
import { saveParkPdf } from "@/lib/save-park";
import { clearHandFont, loadStoredFont, saveHandFont } from "./fonts";
import { TEACHER_PASSWORD } from "./model";
import { appsScriptSource, readScriptUrl, writeScriptUrl } from "./script";
import { useDraft } from "./store";

export function TeacherButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn bg-paper px-4 text-ink" onClick={onClick}>
      <KeyRound aria-hidden />
      Teacher
    </button>
  );
}

export function TeacherSheet({
  onClose,
}: {
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [fontLabel, setFontLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const locked = useDraft((state) => state.locked);
  const unlock = useDraft((state) => state.unlock);
  const resetPupil = useDraft((state) => state.resetPupil);
  const checkDrive = useServerFn(saveParkPdf);

  useEffect(() => {
    setScriptUrl(readScriptUrl());
    void loadStoredFont().then((label) => setFontLabel(label));
  }, []);

  async function copyScript() {
    const source = appsScriptSource();
    try {
      await navigator.clipboard.writeText(source);
      setNotice("Script copied. Paste it into a new Google Apps Script project.");
    } catch {
      setNotice("Select the script below and copy it yourself.");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="teacher-title"
        className="sheet teacher-sheet w-full max-w-2xl overflow-y-auto rounded-3xl border-4 border-ink bg-paper p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="teacher-title" className="font-display text-2xl font-extrabold">
            Teacher
          </h2>
          <button type="button" className="btn bg-paper text-ink" onClick={onClose}>
            <X aria-hidden />
            Close
          </button>
        </div>

        {!open ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (password === TEACHER_PASSWORD) {
                setOpen(true);
                setError("");
              } else {
                setError("That password is not right.");
              }
            }}
          >
            <label className="font-display text-lg font-extrabold" htmlFor="teacher-password">
              Teacher password
            </label>
            <input
              id="teacher-password"
              type="password"
              value={password}
              autoComplete="off"
              autoCapitalize="none"
              className="blank text-left"
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <p className="font-display font-bold text-berry">{error}</p> : null}
            <button type="submit" className="btn bg-berry text-paper">
              Unlock
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-extrabold">This pupil</h3>
              <p className="text-muted">
                {locked
                  ? "The worksheet is locked after a save."
                  : "The worksheet is still open."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn bg-sun text-ink"
                  disabled={!locked}
                  onClick={() => {
                    unlock();
                    setNotice("Unlocked. They can change it and save once more.");
                  }}
                >
                  Allow one more save
                </button>
                {confirmReset ? (
                  <>
                    <button
                      type="button"
                      className="btn bg-berry text-paper"
                      onClick={() => {
                        resetPupil();
                        setConfirmReset(false);
                        setNotice("Cleared for the next pupil.");
                      }}
                    >
                      Yes, clear it
                    </button>
                    <button type="button" className="btn bg-paper text-ink" onClick={() => setConfirmReset(false)}>
                      No
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn bg-paper text-ink" onClick={() => setConfirmReset(true)}>
                    New pupil
                  </button>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-extrabold">Google Drive</h3>
              <ol className="list-decimal space-y-1 pl-5 text-ink">
                <li>Open script.google.com and start a new project.</li>
                <li>Paste this script and save.</li>
                <li>Deploy, then New deployment, then Web app.</li>
                <li>Execute as Me. Who has access: Anyone.</li>
                <li>The worksheet already sends files to your web app. Change the link below only if you deploy a new one.</li>
              </ol>
              <textarea
                readOnly
                className="h-40 w-full rounded-2xl border-4 border-ink bg-paper p-3 font-mono text-sm text-ink"
                value={appsScriptSource()}
                aria-label="Google Apps Script"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn bg-paper text-ink" onClick={() => void copyScript()}>
                  Copy script
                </button>
              </div>
              <label className="font-display font-extrabold" htmlFor="script-url">
                Web app link
              </label>
              <input
                id="script-url"
                value={scriptUrl}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="field"
                onChange={(event) => setScriptUrl(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn bg-berry text-paper"
                  onClick={() => {
                    const trimmed = scriptUrl.trim();
                    writeScriptUrl(trimmed);
                    if (!trimmed) setScriptUrl(readScriptUrl());
                    setNotice(
                      trimmed
                        ? "Drive link saved on this iPad. Other iPads already use the built-in link."
                        : "Cleared. This iPad will use the built-in Drive link.",
                    );
                  }}
                >
                  Save link
                </button>
                <button
                  type="button"
                  className="btn bg-paper text-ink"
                  onClick={() => {
                    const url = scriptUrl.trim();
                    if (!url) {
                      setNotice("Add the web app link first.");
                      return;
                    }
                    void checkDrive({
                      data: {
                        scriptUrl: url,
                        filename: "ping.pdf",
                        ping: true,
                        password: TEACHER_PASSWORD,
                      },
                    }).then((result) => {
                      if (result.ok) writeScriptUrl(url);
                      setNotice(result.ok ? result.detail : result.message);
                    });
                  }}
                >
                  Check the Drive link
                </button>
              </div>
              <p className="text-sm text-muted">
                Saves land in a Drive folder called My Park Worksheets. The file name is the pupil name, class, and Park.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-extrabold">Handwriting font</h3>
              <p>
                {fontLabel
                  ? `Using ${fontLabel} on this iPad.`
                  : "Using Patrick Hand for now. If you have KG Perfect Penmanship, add the .ttf here. It stays on this iPad only."}
              </p>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                aria-label="Handwriting font file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void saveHandFont(file)
                    .then((label) => {
                      setFontLabel(label);
                      setNotice(`Handwriting font set to ${label}.`);
                    })
                    .catch(() => setNotice("That font file could not be used."));
                }}
              />
              {fontLabel ? (
                <button
                  type="button"
                  className="btn bg-paper text-ink"
                  onClick={() => {
                    void clearHandFont().then(() => {
                      setFontLabel(null);
                      setNotice("Back to Patrick Hand.");
                    });
                  }}
                >
                  Remove font file
                </button>
              ) : null}
            </section>
            {notice ? (
              <p className="font-display font-bold text-ink" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
