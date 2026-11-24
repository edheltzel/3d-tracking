// Black Label — React primitives over index.css and ./motion. Every variant builds on these.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import "./fonts";
import { boot, cycle, reduced, scramble, stepClock, tick, typeOn } from "./motion";

export type Polarity = "dark" | "light";

// Root of a Black Label surface: sets polarity, base type, and fills its parent.
export function Surface({
  polarity = "dark",
  grain = false,
  className = "",
  style,
  children,
}: { polarity?: Polarity; grain?: boolean; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div
      data-polarity={polarity}
      className={`bl ${grain ? "bl-grain" : ""} relative h-full w-full overflow-hidden ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function useReducedMotion() {
  const [r, setR] = useState(() => reduced());
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

// Clock in seconds, re-rendering at `fps`. When `time` is a number (Forge holding the
// playhead) it returns that instead, so pure functions of t can be scrubbed.
export function useClock(fps = 60, time?: number | null, { paused = false } = {}) {
  const [t, setT] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (time != null || paused || reduced()) return;
    const base = offset.current;
    return stepClock(fps, (s) => {
      offset.current = base + s;
      setT(base + s);
    });
  }, [fps, time, paused]);
  useEffect(() => {
    if (time != null) offset.current = time;
  }, [time]);
  return time ?? t;
}

// Boot every [data-boot] element under the returned ref, grouped by data-boot-group
// (0, 1, 2… enter in order). Starts hidden via the bl-preboot class to avoid a flash.
// Change `key` to re-run the boot.
export function useBoot<T extends HTMLElement>(key: unknown = 0, opts: { spread?: number; gap?: number } = {}) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.add("bl-preboot");
    const els = [...root.querySelectorAll<HTMLElement>("[data-boot]")];
    const groups: HTMLElement[][] = [];
    for (const el of els) {
      const g = Number(el.dataset.bootGroup ?? 0);
      (groups[g] ??= []).push(el);
    }
    boot(groups.filter(Boolean), { ...opts, root });
  }, [key]);
  return ref;
}

// Readout that Ticks. `source`: a number to jitter around, or (t) => number.
export function Tick({
  source,
  decimals = 5,
  hz = 12,
  jitter,
  intDigits,
  format,
  className = "",
}: {
  source: number | ((t: number) => number);
  decimals?: number;
  hz?: number;
  jitter?: number;
  intDigits?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const src = useRef(source);
  src.current = source;
  useEffect(() => {
    if (!ref.current) return;
    const read = typeof source === "function" ? (t: number) => (src.current as (t: number) => number)(t) : source;
    return tick(ref.current, read, { decimals, hz, jitter, intDigits, format });
  }, [typeof source === "function" ? "fn" : source, decimals, hz, jitter, intDigits]);
  return <span ref={ref} className={`tabular-nums ${className}`} />;
}

// Text that Types on (once), or Cycles through several strings.
export function Typed({ text, cps = 32, cursor = true, className = "" }: { text: string | string[]; cps?: number; cursor?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const key = Array.isArray(text) ? text.join("\u0000") : text;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Array.isArray(text)) return cycle(el, text, { cps });
    typeOn(el, text, { cps, cursor });
  }, [key, cps, cursor]);
  return <span ref={ref} className={className} />;
}

// Text that Scrambles in on mount or when `text` changes.
export function Scrambled({ text, duration = 500, className = "" }: { text: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) scramble(ref.current, text, { duration });
  }, [text, duration]);
  return <span ref={ref} className={className}>{text}</span>;
}

// Hairline module with a header strip: title left, meta right.
export function Panel({
  title,
  meta,
  className = "",
  bodyClassName = "",
  children,
  ...rest
}: { title: ReactNode; meta?: ReactNode; className?: string; bodyClassName?: string; children?: ReactNode } & Record<`data-${string}`, unknown>) {
  return (
    <section className={`bl-panel ${className}`} {...rest}>
      <header>
        <span>{title}</span>
        {meta != null && <span>{meta}</span>}
      </header>
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// [ LABEL ] button. variant="solid" for the one primary action.
export function Btn({ children, variant, onClick, className = "" }: { children: ReactNode; variant?: "solid"; onClick?: () => void; className?: string }) {
  return (
    <button type="button" className={`bl-btn ${className}`} data-variant={variant} onClick={onClick}>
      {children}
    </button>
  );
}

// Status node: filled = on, outline = off, alarm = signal.
export function Node({ on, alarm, className = "" }: { on?: boolean; alarm?: boolean; className?: string }) {
  return <span className={`bl-node ${className}`} data-on={on ? "" : undefined} data-alarm={alarm ? "" : undefined} />;
}

// Label in the instrument voice. dim = ornament-level micro label.
export function Label({ children, dim, className = "" }: { children: ReactNode; dim?: boolean; className?: string }) {
  return <span className={`${dim ? "bl-micro" : "bl-label"} ${className}`}>{children}</span>;
}

// SVG pieces. Use inside <svg className="bl-svg">. Its CSS beats SVG fill=/stroke= attributes,
// so style geometry with className ("solid", "faint", "dash", "signal"…) or inline style.
export function Dot({ x, y, r = 2, className = "" }: { x: number; y: number; r?: number; className?: string }) {
  return <circle cx={x} cy={y} r={r} className={`solid ${className}`} />;
}

export function Crosshair({ x, y, size = 6, ring = 0 }: { x: number; y: number; size?: number; ring?: number }) {
  return (
    <g>
      <line x1={x - size} y1={y} x2={x + size} y2={y} />
      <line x1={x} y1={y - size} x2={x} y2={y + size} />
      {ring > 0 && <circle cx={x} cy={y} r={ring} />}
    </g>
  );
}

// Leader from a point to a label, with a node dot at the origin. side: which way the label sits.
export function Leader({
  x,
  y,
  dx = 40,
  dy = 0,
  text,
  side = "right",
  className = "",
}: { x: number; y: number; dx?: number; dy?: number; text: ReactNode; side?: "left" | "right"; className?: string }) {
  const ex = x + (side === "right" ? dx : -dx);
  const ey = y + dy;
  return (
    <g className={className}>
      <Dot x={x} y={y} r={1.6} />
      <polyline points={`${x},${y} ${x},${ey} ${ex},${ey}`} className="faint" />
      <text x={ex + (side === "right" ? 4 : -4)} y={ey + 3} textAnchor={side === "right" ? "start" : "end"}>
        {text}
      </text>
    </g>
  );
}

export { iso, px, flip, collapse, wipe, morphStep, explode, drift, trace, flicker, sleep, FRAME, SNAP, EASE_CAM, EASE_OUT } from "./motion";
