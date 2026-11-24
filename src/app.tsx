import { useEffect, useState, useRef } from "react";
import TrackingOverlay from "@/variants/tracking-overlay";

type Mode = "rotate" | "pan" | "zoom" | "reset";

const HINTS: { mode: Mode; label: string }[] = [
  { mode: "rotate", label: "Drag: rotate" },
  { mode: "pan", label: "Right / Shift-drag: pan" },
  { mode: "zoom", label: "Scroll: zoom" },
  { mode: "reset", label: "Double-click: reset" },
];


type Colors = { accent: string; asciiColor: string; inkColor: string; cometColor: string; background: string };

const STORAGE_KEY = "tracking-overlay:colors";

const DEFAULTS: Colors = { accent: "#667b5b", asciiColor: "#6b9654", inkColor: "#ffffff", cometColor: "#db7093", background: "#000000" };

const FIELDS: { key: keyof Colors; label: string }[] = [
  { key: "accent", label: "Boxes" },
  { key: "asciiColor", label: "ASCII" },
  { key: "inkColor", label: "Lines" },
  { key: "cometColor", label: "Comet lock" },
  { key: "background", label: "Background" },
];

const PALETTE = [
  "#6b9654", "#667b5b", "#9ec27f", "#3f5a33",
  "#ff2416", "#ff8a3d", "#ffd23f", "#00ff88",
  "#3ddcff", "#4f7cff", "#b46bff", "#db7093",
  "#ffffff", "#9a9a9a", "#101830", "#000000",
];

const HEX = /^#[0-9a-f]{6}$/i;

function load(): Colors {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const out = { ...DEFAULTS };
    for (const { key } of FIELDS) if (typeof saved[key] === "string" && HEX.test(saved[key])) out[key] = saved[key];
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

function HexInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      spellCheck={false}
      maxLength={7}
      onChange={(e) => {
        const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
        setDraft(v);
        if (HEX.test(v)) onChange(v.toLowerCase());
      }}
      onBlur={() => setDraft(value)}
      className="h-8 min-w-0 flex-1 border border-ink-22 bg-transparent px-2 normal-case text-ink outline-none focus:border-ink-40"
    />
  );
}

export default function App() {
  const [colors, setColors] = useState<Colors>(load);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<keyof Colors | null>(null);
  const [active, setActive] = useState<Mode | null>(null);
  const timer = useRef<number>(0);
  const flash = (mode: Mode) => {
    setActive(mode);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(null), 300);
  };
  const set = (key: keyof Colors, value: string) => setColors((c) => ({ ...c, [key]: value }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  }, [colors]);

  return (
    <div className="fixed inset-0">
      <div
        className="absolute inset-0"
        onPointerDown={(e) => setActive(e.button === 0 && !e.shiftKey ? "rotate" : e.button === 0 || e.button === 2 ? "pan" : null)}
        onPointerUp={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
        onWheel={() => flash("zoom")}
        onDoubleClick={() => flash("reset")}
      >
        <TrackingOverlay {...colors} />
      </div>
      <div className="bl pointer-events-none absolute right-3 bottom-3 z-10 flex flex-wrap justify-end gap-x-2 gap-y-1 text-label tracking-widest text-ink-40 uppercase">
        {HINTS.map(({ mode, label }) => (
          <span
            key={mode}
            className="border px-2 py-1 transition-colors duration-150"
            style={
              active === mode
                ? { color: colors.accent, borderColor: colors.accent, background: `${colors.accent}26` }
                : { borderColor: "transparent" }
            }
          >
            {label}
          </span>
        ))}
      </div>
      <div
        className="bl absolute top-3 right-3 z-10 w-56 border border-ink-22 text-label uppercase backdrop-blur-sm"
        style={{ background: `${colors.background}cc` }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full cursor-pointer items-center justify-between px-3 tracking-widest text-ink-70 hover:text-ink"
        >
          Colors
          <span>{open ? "-" : "+"}</span>
        </button>
        {open && (
          <div className="flex flex-col gap-1 border-t border-ink-12 p-3">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col">
                <button
                  type="button"
                  aria-expanded={editing === key}
                  onClick={() => setEditing((k) => (k === key ? null : key))}
                  className={`flex h-10 w-full cursor-pointer items-center justify-between gap-2 hover:text-ink ${editing === key ? "text-ink" : "text-ink-70"}`}
                >
                  {label}
                  <span className="flex items-center gap-2">
                    <span className="normal-case text-ink-40">{colors[key]}</span>
                    <span className="h-6 w-6 border border-ink-22" style={{ background: colors[key] }} />
                  </span>
                </button>
                {editing === key && (
                  <div className="flex flex-col gap-2 pb-2">
                    <div className="grid grid-cols-8 gap-1">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          onClick={() => set(key, c)}
                          className={`aspect-square w-full cursor-pointer border ${colors[key] === c ? "border-ink" : "border-ink-22 hover:border-ink-40"}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <HexInput value={colors[key]} onChange={(v) => set(key, v)} />
                      <input
                        type="color"
                        aria-label={`${label} custom colour`}
                        value={colors[key]}
                        onChange={(e) => set(key, e.target.value)}
                        className="h-8 w-8 cursor-pointer border border-ink-22 bg-transparent p-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setColors({ ...DEFAULTS })}
              className="mt-2 h-10 cursor-pointer border border-ink-22 tracking-widest text-ink-70 hover:border-ink-40 hover:text-ink"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
