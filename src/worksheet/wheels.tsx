import { useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ITEM = 72;

type WheelProps = {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

export function Wheel({ label, options, value, onChange }: WheelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  const ignore = useRef(true);
  const index = Math.max(0, options.indexOf(value));

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    ignore.current = true;
    el.scrollTop = index * ITEM;
    const frame = window.requestAnimationFrame(() => {
      ignore.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [index]);

  function commitFromScroll() {
    if (ignore.current) return;
    const el = scroller.current;
    if (!el) return;
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / ITEM)),
    );
    const next = options[nextIndex];
    if (next && next !== value) onChange(next);
  }

  function nudge(direction: -1 | 1) {
    const next = options[index + direction];
    if (next) onChange(next);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span className="font-display text-sm font-extrabold tracking-wide text-muted uppercase">
        {label}
      </span>
      <button type="button" className="btn bg-paper px-5 text-ink" onClick={() => nudge(-1)} aria-label={`${label} previous`}>
        <ChevronUp aria-hidden />
      </button>
      <div className="relative w-full">
        <div
          className="pointer-events-none absolute inset-x-1 rounded-2xl border-4 border-ink bg-sun/80"
          style={{ top: ITEM, height: ITEM }}
        />
        <div
          ref={scroller}
          className="no-scrollbar relative snap-y snap-mandatory overflow-y-auto"
          style={{ height: ITEM * 3 }}
          tabIndex={0}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${label}-${value}`}
          onScroll={() => {
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(commitFromScroll, 80);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              nudge(1);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              nudge(-1);
            }
          }}
        >
          <div style={{ height: ITEM }} />
          {options.map((option) => (
            <div
              key={option}
              id={`${label}-${option}`}
              role="option"
              aria-selected={option === value}
              className="flex snap-center items-center justify-center px-2 text-center font-display text-xl font-extrabold text-ink"
              style={{ height: ITEM }}
            >
              {option}
            </div>
          ))}
          <div style={{ height: ITEM }} />
        </div>
      </div>
      <button type="button" className="btn bg-paper px-5 text-ink" onClick={() => nudge(1)} aria-label={`${label} next`}>
        <ChevronDown aria-hidden />
      </button>
    </div>
  );
}
