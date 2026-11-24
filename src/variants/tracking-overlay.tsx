// Tracking overlay — archetype E (731406121). The tracking layer alone, no subject drawn:
// churning detections (red boxes, node dots, `x: 969  y: 1596` callouts in source-video
// coordinates, long grey arcs with arrowheads) that trace an invisible fragmented body.
// Each box is filled with churning ASCII, densest around its node.
// The scene is 3D: every point takes a depth from the body and a camera orbits it (drag pans,
// right/shift-drag orbits, scroll zooms, double-click resets). Boxes, ASCII and callouts stay flat and face the screen; only their position is 3D.
// Everything is a pure function of t and the camera (scrubbable via `time`), drawn on one canvas.
import { useEffect, useRef, useState } from "react";
import { Surface, useClock, useReducedMotion, type Polarity } from "@/lib/bl";

type Props = {
  polarity?: Polarity;
  tracks?: number;
  churn?: number;
  connectors?: boolean;
  bend?: number;
  bendSpread?: number;
  linkWeight?: number;
  linkOpacity?: number;
  arrows?: boolean;
  labels?: boolean;
  ascii?: boolean;
  asciiColor?: string;
  accent?: string;
  inkColor?: string;
  background?: string;
  depth?: number;
  autoRotate?: number;
  speed?: number;
  stage?: boolean;
  gridOpacity?: number;
  bloom?: number;
  bloomRadius?: number;
  fps?: number;
  time?: number | null;
};

// Deterministic hash → [0,1)
function hash(...n: number[]) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000003) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100000) / 100000;
}

// Smooth 1D value noise in [-1,1]
function noise(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i, seed) * 2 - 1;
  const b = hash(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

const STRANDS = 13;
const JOINTS = 14;
// Source-video coordinate frame the callouts report in (the reference reads x 700–1600, y 1500–2900).
const SRC = { x0: 640, y0: 1480, w: 1080, h: 1350 };

type Pt = { x: number; y: number };

// One strand = a limb-like streak: a base that wanders, a direction that sways, joints along it.
// Strands gather around three foci, like limbs of one body: a main mass and two satellites.
const FOCI = [
  { x: 0.5, y: 0.6, r: 0.13 },
  { x: 0.8, y: 0.3, r: 0.06 },
  { x: 0.24, y: 0.4, r: 0.08 },
];
function strand(s: number, t: number, w: number, h: number): Pt[] {
  const f = FOCI[s % 3 === 0 ? 0 : s % 5 === 1 ? 1 : s % 5 === 2 ? 2 : 0];
  const cx = w * (f.x + 0.05 * noise(t * 0.18 + s * 3.1, 11 + s));
  const cy = h * (f.y + 0.05 * noise(t * 0.15 + s * 1.7, 29 + s));
  const bx = cx + w * f.r * noise(t * 0.4 + s * 7.3, 5 + s);
  const by = cy + h * f.r * noise(t * 0.35 + s * 4.9, 17 + s);
  // Mostly steep diagonals, like the reference's limbs
  let a = -1.15 + 0.5 * noise(t * 0.5 + s * 2.3, 41 + s) + (hash(s, 9) - 0.5) * 1.2;
  const seg = Math.min(w, h) * (0.022 + 0.012 * hash(s, 13));
  const pts: Pt[] = [];
  let x = bx;
  let y = by;
  for (let j = 0; j < JOINTS; j++) {
    pts.push({ x, y });
    a += 0.16 * noise(t * 0.9 + j * 0.37 + s * 5.1, 71 + s);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
  }
  return pts;
}

// Which pieces of a strand are visible, and how thick (fragmentation).
function piece(s: number, j: number, t: number) {
  const on = noise(j * 0.55 + t * 1.6 + s * 9.7, 101 + s);
  const width = 3 + 11 * (0.5 + 0.5 * noise(j * 0.3 + t * 0.7 + s, 131 + s));
  return { visible: on > -0.15, width };
}

type Track = { id: number; p: Pt; bw: number; bh: number; s: number; j: number };

function detect(t: number, frame: number, n: number, churn: number, strands: Pt[][]): Track[] {
  const out: Track[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < n; i++) {
    // Each slot lives in windows of its own length; churn shortens them and kills more.
    const life = (0.35 + 1.6 * hash(i, 1)) * (1.15 - churn);
    const k = Math.floor((t + hash(i, 2) * life) / life);
    if (hash(i, k, 3) < 0.08 + churn * 0.2) continue;
    // Per-frame dropout, the flicker of a real detector
    if (hash(i, frame, 4) < churn * 0.12) continue;
    const s = Math.floor(hash(i, k, 5) * STRANDS);
    // Lock onto the nearest visible piece of the chosen strand; drop the track if there is none.
    let j = Math.floor(hash(i, k, 6) * (JOINTS - 2)) + 1;
    let tries = 0;
    while (!piece(s, j, t).visible && tries < JOINTS) {
      j = (j + 1) % (JOINTS - 1);
      tries++;
    }
    if (tries >= JOINTS || taken.has(s * JOINTS + j)) continue;
    taken.add(s * JOINTS + j);
    const q = strands[s][j];
    const tall = hash(i, k, 7) < 0.3;
    const bw = (tall ? 40 : 14) + 50 * hash(i, k, 8) ** 2 + 3 * hash(i, frame, 9);
    const bh = (tall ? 110 : 18) + 90 * hash(i, k, 10) ** 2 + 3 * hash(i, frame, 11);
    out.push({ id: i, p: q, bw, bh, s, j });
  }
  return out;
}

// #rgb / #rrggbb + alpha → rgba() (canvas can't be trusted with color-mix()).
function rgba(hex: string, a: number) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return Number.isNaN(n) ? `rgba(255,255,255,${a})` : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function toSrc(p: Pt, w: number, h: number) {
  return { x: Math.round(SRC.x0 + (p.x / w) * SRC.w), y: Math.round(SRC.y0 + (p.y / h) * SRC.h) };
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size = 5) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.45) * size, y - Math.sin(ang - 0.45) * size);
  ctx.lineTo(x - Math.cos(ang + 0.45) * size, y - Math.sin(ang + 0.45) * size);
  ctx.closePath();
  ctx.fill();
}

// ASCII fill for one box, in the box's own frame (0..bw, 0..bh): a density ramp driven by
// distance to the node plus drifting noise. The caller maps that frame into the scene.
const RAMP = " .:-=+*#%@";
const CELL = { w: 6, h: 9 };
function asciiFill(ctx: CanvasRenderingContext2D, bw: number, bh: number, node: Pt, id: number, t: number, alpha: number, o: { ink: string; mono: string }) {
  const cols = Math.floor((bw - 2) / CELL.w);
  const rows = Math.floor((bh - 2) / CELL.h);
  if (cols < 1 || rows < 1) return;
  const ox = (bw - cols * CELL.w) / 2 + CELL.w / 2;
  const oy = (bh - rows * CELL.h) / 2 + CELL.h / 2;
  ctx.font = `400 8px ${o.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = o.ink;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = ox + c * CELL.w;
      const py = oy + r * CELL.h;
      const d = Math.hypot((px - node.x) / Math.max(bw, 24), (py - node.y) / Math.max(bh, 24));
      const n = noise(c * 0.6 + t * 2.4 + id * 13, 500 + r * 3 + id * 31);
      const v = Math.max(0, Math.min(0.999, 0.75 - d * 1.1 + n * 0.45));
      const glyph = RAMP[Math.floor(v * RAMP.length)];
      if (glyph === " ") continue;
      ctx.globalAlpha = (0.25 + 0.6 * v) * alpha;
      ctx.fillText(glyph, px, py);
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
}

// Connector shape: bend scales how far arcs bow off the chord (0 = straight); spread is how much
// that varies per link (0 = every link bows the same amount to the same side, 1 = random both ways,
// twisting out of the picture plane too).
type Curve = { bend: number; spread: number; weight: number; opacity: number; arrows: boolean };

// World space is the frame centred on its middle (x right, y down) plus a depth z. The camera
// orbits that centre: yaw about y, then pitch about x. At yaw = pitch = 0 and zoom 1 the z = 0
// plane lands exactly on the 2D layout.
type V3 = { x: number; y: number; z: number };
type Cam = { yaw: number; pitch: number; zoom: number; px: number; py: number };

function camera(w: number, h: number, cam: Cam) {
  const f = Math.max(w, h) * 1.1;
  const dist = f * cam.zoom;
  const cx = w / 2 + cam.px;
  const cy0 = h / 2 + cam.py;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const rotate = (p: V3) => {
    const x1 = p.x * cy + p.z * sy;
    const z1 = -p.x * sy + p.z * cy;
    return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
  };
  const project = (p: V3) => {
    const c = rotate(p);
    const z = Math.max(c.z + dist, 1);
    const s = f / z;
    return { x: cx + c.x * s, y: cy0 + c.y * s, s, z };
  };
  return { project, rotate, dist, f, cx, cy: cy0 };
}

// Depth of joint j on strand s: each limb sits at its own depth and tilts through it as it runs.
function strandZ(s: number, j: number, t: number, S: number) {
  return S * ((hash(s, 51) - 0.5) * 0.6 + (hash(s, 52) - 0.5) * 0.03 * j + 0.05 * noise(t * 0.25 + s * 2.1, 61 + s));
}

// Nearer reads brighter: alpha falls off with camera depth.
const fog = (z: number, dist: number) => Math.max(0.3, Math.min(1, 1.6 - 0.7 * (z / dist)));

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  t: number,
  frame: number,
  cam: Cam,
  o: { tracks: number; churn: number; connectors: boolean; labels: boolean; ascii: boolean; depth: number; stage: boolean; gridOpacity: number; curve: Curve; ink: string; asciiInk: string; void: string; signal: string; dim: string; font: string; mono: string }
) {
  ctx.fillStyle = o.void;
  ctx.fillRect(0, 0, w, h);
  const S = Math.min(w, h);
  const { project, rotate, dist, f, cx, cy } = camera(w, h, cam);
  const world = (p: Pt, z: number): V3 => ({ x: p.x - w / 2, y: p.y - h / 2, z });

  // Floor grid just under the lowest detections: wide, fading out from the centre so it has no
  // hard edge. Lines are clipped at a near plane so they don't drop out when they pass the camera.
  if (o.stage) {
    const fy = h * 0.3;
    const R = Math.max(w, h) * 1.6;
    const step = Math.max(40, Math.round(S / 12));
    const K = Math.floor(R / step);
    const N = 16;
    const near = 24;
    const seg = (a: V3, b: V3) => {
      const ca = rotate(a);
      const cb = rotate(b);
      ca.z += dist;
      cb.z += dist;
      if (ca.z < near && cb.z < near) return;
      const clip = (p: V3, q: V3) => {
        const k = (near - p.z) / (q.z - p.z);
        return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: near };
      };
      const pa = ca.z < near ? clip(ca, cb) : ca;
      const pb = cb.z < near ? clip(cb, ca) : cb;
      ctx.moveTo(cx + (pa.x * f) / pa.z, cy + (pa.y * f) / pa.z);
      ctx.lineTo(cx + (pb.x * f) / pb.z, cy + (pb.y * f) / pb.z);
    };
    ctx.lineWidth = 1;
    for (let k = -K; k <= K; k++) {
      const u = k * step;
      for (let i = 0; i < N; i++) {
        const v0 = -R + (2 * R * i) / N;
        const v1 = v0 + (2 * R) / N;
        const r = Math.hypot(u, (v0 + v1) / 2) / R;
        if (r >= 1) continue;
        ctx.strokeStyle = rgba(o.ink, o.gridOpacity * (1 - r) ** 1.6);
        ctx.beginPath();
        seg({ x: u, y: fy, z: v0 }, { x: u, y: fy, z: v1 });
        seg({ x: v0, y: fy, z: u }, { x: v1, y: fy, z: u });
        ctx.stroke();
      }
    }
  }

  // The subject's strands are never drawn; they only steer where specks and detections land.
  const live = Array.from({ length: STRANDS }, (_, s) => strand(s, t, w, h));

  // Specks
  ctx.fillStyle = o.signal;
  for (let i = 0; i < 26; i++) {
    const s = i % STRANDS;
    const j = Math.floor(hash(i, 21) * JOINTS);
    const q = live[s][j];
    const dx = (hash(i, Math.floor(t * 2), 23) - 0.5) * 60;
    const dy = (hash(i, Math.floor(t * 2), 24) - 0.5) * 60;
    const dz = (hash(i, Math.floor(t * 2), 25) - 0.5) * 60;
    const sp = project(world({ x: q.x + dx, y: q.y + dy }, (strandZ(s, j, t, S) + dz) * o.depth));
    ctx.globalAlpha = 0.55 * fog(sp.z, dist);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (1 + 2.2 * hash(i, 22)) * sp.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tracks = detect(t, frame, o.tracks, o.churn, live).map((k) => ({
    ...k,
    z: strandZ(k.s, k.j, t, S) * o.depth,
  }));

  // Connectors: long thin 3D arcs between tracked points, bulging far off the chord.
  if (o.connectors && tracks.length > 1) {
    const { bend, spread, weight, opacity, arrows } = o.curve;
    ctx.lineWidth = weight;
    for (const A of tracks) {
      const B = tracks[Math.floor(hash(A.id, 31) * tracks.length)];
      if (!B || B === A) continue;
      const a = world(A.p, A.z);
      const b = world(B.p, B.z);
      const c = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const len = Math.hypot(c.x, c.y, c.z) || 1;
      const flat = Math.hypot(c.x, c.y) || 1;
      // n1: perpendicular in the picture plane (the 2D bulge); n2: out of it.
      const n1 = { x: -c.y / flat, y: c.x / flat, z: 0 };
      const n2 = { x: (c.y * n1.z - c.z * n1.y) / len, y: (c.z * n1.x - c.x * n1.z) / len, z: (c.x * n1.y - c.y * n1.x) / len };
      const side = 0.5 + (hash(A.id, B.id, 32) - 1) * spread;
      const bulge = side * 2.4 * bend * Math.max(len, 160);
      const phi = (hash(A.id, B.id, 34) - 0.5) * 1.6 * spread;
      const k1 = Math.cos(phi) * bulge;
      const k2 = Math.sin(phi) * bulge;
      const m = { x: (a.x + b.x) / 2 + n1.x * k1 + n2.x * k2, y: (a.y + b.y) / 2 + n1.y * k1 + n2.y * k2, z: (a.z + b.z) / 2 + n2.z * k2 };
      const at = (u: number) => {
        const v = 1 - u;
        return project({
          x: v * v * a.x + 2 * v * u * m.x + u * u * b.x,
          y: v * v * a.y + 2 * v * u * m.y + u * u * b.y,
          z: v * v * a.z + 2 * v * u * m.z + u * u * b.z,
        });
      };
      const mid = at(0.5);
      ctx.strokeStyle = rgba(o.ink, opacity * fog(mid.z, dist));
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const q = at(i / 28);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      // Arrowhead near the target, along the curve's end tangent
      if (arrows) {
        const tip = at(0.97);
        const prev = at(0.93);
        arrow(ctx, tip.x, tip.y, Math.atan2(tip.y - prev.y, tip.x - prev.x), 4 + weight);
      }
    }
  }

  // Boxes are flat and face the screen, like the callouts: only their position is 3D.
  // Drawn far to near so nearer boxes sit on top.
  const boxes = tracks.map((k) => ({ k, node: project(world(k.p, k.z)) })).sort((A, B) => B.node.z - A.node.z);

  const placed: { x: number; y: number; w: number }[] = [];
  for (const { k, node } of boxes) {
    const alpha = fog(node.z, dist);
    const bw = Math.round(k.bw);
    const bh = Math.round(k.bh);
    const bx = Math.round(node.x - k.bw * (0.2 + 0.6 * hash(k.id, 41))) + 0.5;
    const by = Math.round(node.y - k.bh * (0.1 + 0.5 * hash(k.id, 42))) + 0.5;
    if (o.ascii) {
      ctx.setTransform(dpr, 0, 0, dpr, dpr * bx, dpr * by);
      asciiFill(ctx, bw, bh, { x: node.x - bx, y: node.y - by }, k.id, t, alpha, { ink: o.asciiInk, mono: o.mono });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = o.signal;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = o.signal;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // the small grey heading marker beside each dot
    ctx.fillStyle = o.dim;
    arrow(ctx, node.x + 7, node.y - 3, -0.6, 4);
    ctx.globalAlpha = 1;
    if (!o.labels) continue;
    ctx.font = o.font;
    ctx.textBaseline = "alphabetic";
    const src = toSrc(k.p, w, h);
    const text = `x: ${src.x}  y: ${src.y}  z: ${Math.round(1000 + (k.z / S) * 1000)}`;
    const tw = ctx.measureText(text).width;
    // Above the box; step up past any label already placed there (labels never collide).
    let lx = Math.max(4, Math.min(w - tw - 4, bx));
    let ly = Math.max(14, by - 5);
    for (let guard = 0; guard < 6; guard++) {
      const hit = placed.find((p) => Math.abs(p.y - ly) < 15 && lx < p.x + p.w + 10 && p.x < lx + tw + 10);
      if (!hit) break;
      ly = hit.y - 15;
    }
    placed.push({ x: lx, y: ly, w: tw });
    ctx.fillStyle = o.ink;
    ctx.globalAlpha = Math.max(0.55, alpha);
    ctx.fillText(text, lx, ly);
    ctx.globalAlpha = 1;
  }

  // Axis gizmo, bottom left
  if (o.stage) {
    const gx = 34;
    const gy = h - 34;
    ctx.font = `400 9px ${o.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    for (const [label, v] of [["x", { x: 1, y: 0, z: 0 }], ["y", { x: 0, y: 1, z: 0 }], ["z", { x: 0, y: 0, z: 1 }]] as const) {
      const r = rotate(v);
      ctx.strokeStyle = o.dim;
      ctx.fillStyle = o.dim;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + r.x * 18, gy + r.y * 18);
      ctx.stroke();
      ctx.fillText(label, gx + r.x * 26, gy + r.y * 26);
    }
    ctx.textAlign = "start";
  }
}

// Where the camera starts: a three-quarter view, so depth reads at once.
const VIEW = { yaw: -0.42, pitch: 0.24, zoom: 1, px: 0, py: 0 };

export default function TrackingOverlay({
  polarity = "dark",
  tracks = 22,
  churn = 0.5,
  connectors = true,
  bend = 1,
  bendSpread = 1,
  linkWeight = 1,
  linkOpacity = 0.4,
  arrows = true,
  labels = true,
  ascii = true,
  asciiColor,
  accent,
  inkColor,
  background,
  depth = 1,
  autoRotate = 0.06,
  speed = 0.65,
  stage = true,
  gridOpacity = 0.08,
  bloom = 0.6,
  bloomRadius = 10,
  fps = 25,
  time,
}: Props) {
  const reduced = useReducedMotion();
  const clock = useClock(fps, reduced && time == null ? 2.4 : time, { paused: reduced });
  const t = time == null ? clock * speed : clock;
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Bloom: two half-resolution copies of the frame, blurred by CSS and screened over it.
  const glow = useRef<HTMLCanvasElement>(null);
  const halo = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const [sized, setSized] = useState(0);
  // The user's orbit, kept in a ref; `moved` re-renders while the playhead is held.
  const orbit = useRef({ ...VIEW });
  const drag = useRef<{ x: number; y: number; orbit: boolean } | null>(null);
  const [moved, setMoved] = useState(0);

  useEffect(() => {
    const el = host.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      setSized((n) => n + 1);
    });
    ro.observe(el);
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      drag.current = { x: e.clientX, y: e.clientY, orbit: e.button === 2 || e.shiftKey };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const o = orbit.current;
      if (d.orbit) {
        o.yaw -= (e.clientX - d.x) * 0.006;
        o.pitch = Math.max(-1.35, Math.min(1.35, o.pitch + (e.clientY - d.y) * 0.006));
      } else {
        o.px += e.clientX - d.x;
        o.py += e.clientY - d.y;
      }
      drag.current = { ...d, x: e.clientX, y: e.clientY };
      setMoved((n) => n + 1);
    };
    const up = () => {
      drag.current = null;
      el.style.cursor = "grab";
    };
    const menu = (e: MouseEvent) => e.preventDefault();
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const o = orbit.current;
      o.zoom = Math.max(0.45, Math.min(2.5, o.zoom * Math.exp(e.deltaY * 0.001)));
      setMoved((n) => n + 1);
    };
    const reset = () => {
      orbit.current = { ...VIEW };
      setMoved((n) => n + 1);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("contextmenu", menu);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", reset);
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("contextmenu", menu);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", reset);
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    const el = host.current;
    if (!cv || !el) return;
    const ctx = cv.getContext("2d");
    const { w, h, dpr } = size.current;
    if (!ctx || !w || !h) return;
    const cs = getComputedStyle(el);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    const ink = inkColor || v("--bl-ink") || "#fff";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const snapped = Math.floor(t * fps) / fps;
    const o = orbit.current;
    draw(ctx, w, h, dpr, snapped, Math.floor(t * fps), { ...o, yaw: o.yaw + snapped * autoRotate }, {
      tracks: Math.max(0, Math.min(40, Math.round(tracks))),
      churn: Math.max(0, Math.min(1, churn)),
      connectors,
      curve: {
        bend: Math.max(0, bend),
        spread: Math.max(0, Math.min(1, bendSpread)),
        weight: Math.max(0.25, linkWeight),
        opacity: Math.max(0, Math.min(1, linkOpacity)),
        arrows,
      },
      labels,
      ascii,
      depth: Math.max(0, depth),
      stage,
      gridOpacity: Math.max(0, Math.min(1, gridOpacity)),
      ink,
      // Colour props take any CSS colour; unset, they follow the polarity's ink and signal.
      asciiInk: asciiColor || ink,
      void: background || v("--bl-void") || "#000",
      signal: accent || v("--bl-signal") || "#ff2416",
      dim: rgba(ink, 0.4),
      font: `400 11px ${v("--bl-survey") || "Archivo, sans-serif"}`,
      mono: v("--bl-mono") || "monospace",
    });
    for (const b of bloom > 0 ? [glow.current, halo.current] : []) {
      const bctx = b?.getContext("2d");
      if (!b || !bctx) continue;
      const bw = Math.max(1, Math.round(w / 2));
      const bh = Math.max(1, Math.round(h / 2));
      if (b.width !== bw || b.height !== bh) {
        b.width = bw;
        b.height = bh;
      }
      bctx.clearRect(0, 0, b.width, b.height);
      bctx.drawImage(cv, 0, 0, b.width, b.height);
    }
  }, [bloom, bloomRadius, t, fps, tracks, churn, connectors, bend, bendSpread, linkWeight, linkOpacity, arrows, labels, ascii, asciiColor, accent, inkColor, background, depth, autoRotate, stage, gridOpacity, polarity, sized, moved]);

  return (
    <Surface polarity={polarity}>
      <div ref={host} className="absolute inset-0" style={{ cursor: "grab", touchAction: "none" }}>
        <canvas ref={canvas} className="block" />
        {bloom > 0 &&
          ([
            [glow, 1, Math.min(1, bloom)],
            [halo, 3, Math.min(1, bloom * 0.7)],
          ] as const).map(([ref, spread, opacity], i) => (
            <canvas
              key={i}
              ref={ref}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{
                filter: `blur(${Math.max(0, bloomRadius) * spread}px) brightness(1.6)`,
                opacity,
                mixBlendMode: polarity === "light" ? "multiply" : "screen",
              }}
            />
          ))}
      </div>
    </Surface>
  );
}
