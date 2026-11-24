// Black Label — motion helpers. Dependency-free; see the black-label skill.
// Move names match SKILL.md. Author elements in their final state: every helper animates
// toward what is already in the DOM, and under prefers-reduced-motion it shows that state.

export const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const FRAME = 1000 / 24;
export const SNAP = 170;
export const EASE_CAM = "cubic-bezier(.7,0,.2,1)";
export const EASE_OUT = "cubic-bezier(.2,0,0,1)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Quantized clock: calls fn(t, frame) at most `fps` times per second, with t in seconds
// snapped to that rate. Returns stop().
export function stepClock(fps, fn) {
  let raf = 0;
  let last = -1;
  const t0 = performance.now();
  const loop = (now) => {
    const frame = Math.floor(((now - t0) / 1000) * fps);
    if (frame !== last) {
      last = frame;
      fn(frame / fps, frame);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

// Flicker: one element, 0 → 1 → 0.15 → 1 over three frames. Offsets make the steps
// explicit; a steps() easing on the whole effect would never show the middle keyframe.
export function flicker(el, { frames = 3 } = {}) {
  if (reduced()) return Promise.resolve();
  return el.animate(
    [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: 1 / 3 },
      { opacity: 0.15, offset: 1 / 3 },
      { opacity: 0.15, offset: 2 / 3 },
      { opacity: 1, offset: 2 / 3 },
      { opacity: 1, offset: 1 },
    ],
    { duration: FRAME * frames }
  ).finished;
}

// Trace: draw an SVG stroke on. Draws solid; for a dashed line, trace a solid copy then swap.
// With vector-effect: non-scaling-stroke, dashes are measured in screen pixels, so the
// user-unit length is scaled by the element's CTM.
export function trace(el, { duration = 600, delay = 0, easing = EASE_OUT } = {}) {
  if (reduced()) return Promise.resolve();
  let len = el.getTotalLength();
  if (getComputedStyle(el).vectorEffect === "non-scaling-stroke") {
    const m = el.getScreenCTM();
    if (m) len *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }
  el.style.strokeDasharray = `${len} ${len}`;
  const a = el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, easing, fill: "backwards" });
  return a.finished.then(() => (el.style.strokeDasharray = ""));
}

// Scramble: each glyph cycles through symbols, then locks, left to right.
const GLYPHS = "▖▗▘▙▚▛▜▝▞▟/\\|-_=+*#<>[]:;0123456789";
export async function scramble(el, text = el.textContent, { duration = 500, fps = 24, glyphs = GLYPHS } = {}) {
  if (reduced()) {
    el.textContent = text;
    return;
  }
  const frames = Math.max(1, Math.round((duration / 1000) * fps));
  for (let f = 0; f <= frames; f++) {
    const locked = Math.floor((f / frames) * text.length);
    let out = text.slice(0, locked);
    for (let i = locked; i < text.length; i++) out += text[i] === " " || text[i] === "\n" ? text[i] : glyphs[(Math.random() * glyphs.length) | 0];
    el.textContent = out;
    await sleep(1000 / fps);
  }
  el.textContent = text;
}

// Boot: groups enter in order (e.g. [lines, arcs, labels]). Within a group, members enter
// at random moments across `spread` ms, so group length doesn't grow with element count.
// Each element's entrance comes from its data-boot attribute:
//   "pop" (or none)  appears whole
//   "trace"          SVG geometry draws on
//   "scramble"       text glyph-cycles in
//   "flicker"        appears with a 3-frame flicker
// To avoid a flash of finished content before this runs, put class="bl-preboot" on <html>
// or on `root` (black-label.css hides [data-boot] under it); boot() removes the class.
// Pass { powerDown: true } to first drop the elements out one by one, then hold black.
export async function boot(groups, { spread = 400, gap = 80, powerDown = false, blackout = 250, root = document.documentElement } = {}) {
  const all = groups.flat();
  const ready = () => root.classList.remove("bl-preboot");
  if (reduced()) {
    all.forEach((el) => (el.style.visibility = ""));
    ready();
    return;
  }
  if (powerDown) {
    for (const el of shuffle(all)) {
      el.style.visibility = "hidden";
      await sleep(1000 / all.length);
    }
    await sleep(blackout);
  } else {
    all.forEach((el) => (el.style.visibility = "hidden"));
  }
  ready();
  const enter = async (el) => {
    await sleep(rand(0, spread));
    el.style.visibility = "";
    const kind = el.dataset?.boot;
    if (kind === "trace") await trace(el, { duration: rand(300, 700) });
    else if (kind === "scramble") await scramble(el);
    else if (kind === "flicker") await flicker(el);
  };
  const runs = [];
  for (const group of groups) {
    runs.push(...group.map(enter));
    await sleep(spread + gap);
  }
  await Promise.all(runs);
}

// Tick: a readout that updates at a fixed precision, `hz` times per second. Values that
// follow real geometry are fine; the stepped update rate is what makes it a Tick.
// `source` is a number (jitters around it) or a function (t) => number.
// `format` overrides the default: e.g. (v) => `${v.toFixed(4)} N`, or a clock. Returns stop().
const signed = (v, d, w) => (v < 0 ? "-" : "") + Math.abs(v).toFixed(d).padStart(w, "0");
export function tick(el, source, { decimals = 5, hz = 12, jitter = 0.002, intDigits = 0, format = undefined as ((v: number) => string) | undefined } = {}) {
  const fmt = format ?? ((v) => signed(v, decimals, intDigits ? intDigits + (decimals ? decimals + 1 : 0) : 0));
  const read = (t) => (typeof source === "function" ? source(t) : source + rand(-jitter, jitter) * Math.abs(source || 1));
  return stepClock(reduced() ? 1 : hz, (t) => (el.textContent = fmt(read(t))));
}

// Cycle: Type a list of status strings in turn, holding each. Returns stop().
export function cycle(el, strings, { hold = 1800, cps = 32 } = {}) {
  if (reduced()) {
    el.textContent = strings[0];
    return () => {};
  }
  let stopped = false;
  (async () => {
    for (let i = 0; !stopped; i = (i + 1) % strings.length) {
      await type(el, strings[i], { cps, hold: 0 });
      await sleep(hold);
    }
  })();
  return () => (stopped = true);
}

// Type: character by character, with a block cursor that lingers for `hold` ms.
export async function type(el, text, { cps = 32, cursor = true, hold = 600 } = {}) {
  if (reduced()) {
    el.textContent = text;
    return;
  }
  for (let i = 1; i <= text.length; i++) {
    el.textContent = text.slice(0, i) + (cursor ? "▌" : "");
    await sleep(1000 / cps);
  }
  if (cursor) await sleep(hold);
  el.textContent = text;
}

// Track: pin a box (and optional label) to a target every frame.
// getPoint() => {x, y, w?, h?} in the box's offset-parent coordinates. Returns stop().
export function track(box, getPoint, { label = undefined as HTMLElement | undefined, fps = 60, format = (p) => `x: ${Math.round(p.x)}  y: ${Math.round(p.y)}` } = {}) {
  let size = null;
  const place = () => {
    const p = getPoint();
    if (p.w != null) box.style.width = `${p.w}px`;
    if (p.h != null) box.style.height = `${p.h}px`;
    if (p.w == null || p.h == null) size ??= { w: box.offsetWidth, h: box.offsetHeight };
    const w = p.w ?? size.w;
    const h = p.h ?? size.h;
    box.style.transform = `translate(${Math.round(p.x - w / 2)}px, ${Math.round(p.y - h / 2)}px)`;
    if (label) label.textContent = format(p);
  };
  return stepClock(reduced() ? 1 : fps, place);
}

// Flip: polarity cut on `root`. Enforces a minimum interval between flips (default 1s,
// the looped-flash limit in SKILL.md). Pass { decorative: false } for a real mode change:
// it then also applies under reduced motion. Returns whether it flipped.
let lastFlip = -Infinity;
export function flip(root = document.documentElement, { to = undefined as string | undefined, decorative = true, minInterval = 1000 } = {}) {
  if (decorative && reduced()) return false;
  const now = performance.now();
  if (decorative && now - lastFlip < minInterval) return false;
  lastFlip = now;
  root.dataset.polarity = to ?? (root.dataset.polarity === "light" ? "dark" : "light");
  return true;
}

// Wipe: a hard-edged panel crosses the frame. `panel` is an absolutely positioned
// full-height block in ink or void; direction is "left" or "right".
export function wipe(panel, { duration = SNAP, direction = "left" } = {}) {
  if (reduced()) return Promise.resolve();
  const [a, b] = direction === "left" ? ["100%", "-100%"] : ["-100%", "100%"];
  const anim = panel.animate([{ transform: `translateX(${a})` }, { transform: `translateX(${b})` }], { duration: duration * 2, easing: EASE_CAM });
  return anim.finished;
}

// Collapse: shrink to a point, hold an empty frame or few, run `between` (swap content,
// flip()), expand. Pair with wipe() started at the same moment.
export async function collapse(el, between, { duration = SNAP, blank = 4, origin = "50% 50%" } = {}) {
  if (reduced()) {
    await between?.();
    return;
  }
  el.style.transformOrigin = origin;
  const out = el.animate([{ transform: "scale(1)" }, { transform: "scale(0)" }], { duration, easing: EASE_CAM, fill: "forwards" });
  await out.finished;
  await between?.();
  await sleep(FRAME * blank);
  const back = el.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration, easing: EASE_CAM });
  out.cancel();
  await back.finished;
}

// Morph-step: cut between families on a fixed beat; inside a family, render continuously
// at `fps` with a local phase p in [0,1). families: array of (p, t) => void renderers.
// Draw 2–4 echoes inside the renderer (e.g. repeat at p - 0.04k with falling opacity).
// Returns stop(). Under reduced motion renders family 0 at p = 0 once.
export function morphStep(families, { beat = 800, fps = 15, loop = true, onCut = undefined as ((k: number) => void) | undefined } = {}) {
  if (reduced()) {
    families[0](0, 0);
    return () => {};
  }
  let current = -1;
  const span = beat / 1000;
  let stop = () => {};
  stop = stepClock(fps, (t) => {
    let k = Math.floor(t / span);
    if (!loop && k >= families.length) return stop();
    k %= families.length;
    if (k !== current) {
      current = k;
      onCut?.(k);
    }
    families[k]((t % span) / span, t);
  });
  return () => stop();
}

// Explode: step through discrete states at a low rate, holding the key state longer.
// states: array of () => void that each set one exploded arrangement. Returns stop().
export function explode(states, { fps = 3.3, keyHold = 2000 } = {}) {
  if (reduced()) {
    states[0]();
    return () => {};
  }
  let stopped = false;
  (async () => {
    while (!stopped) {
      for (let i = 0; i < states.length && !stopped; i++) {
        states[i]();
        await sleep(i === 0 ? keyHold : 1000 / fps);
      }
    }
  })();
  return () => (stopped = true);
}

// Drift: constant-velocity ambient loop. fn(phase in [0,1), t). Returns stop().
// Each call has its own clock; to keep several drifts in phase, drive them from one drift().
// Paused at phase 0 under reduced motion.
export function drift(period, fn, { fps = 60 } = {}) {
  if (reduced()) {
    fn(0, 0);
    return () => {};
  }
  return stepClock(fps, (t) => fn((t / period) % 1, t));
}

// True 30° isometric projection; +z is up. Returns screen {x, y}.
const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);
export function iso(x, y, z = 0, scale = 1) {
  return { x: (x - y) * C * scale, y: ((x + y) * S - z) * scale };
}

// Crisp 1px canvas coordinate.
export const px = (v) => Math.round(v) + 0.5;
export const typeOn = type;
