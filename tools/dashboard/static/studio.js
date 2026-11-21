// The pixel studio map (left side of the dashboard): five rooms, furniture, and the crew
// walking between rooms and working, driven by the board's latest /api/state.
//
// Drawn at a fixed 332x270 buffer, scaled by a whole number with smoothing off; name tags and
// room labels are crisp canvas text on top. The static background is painted once into an
// offscreen buffer; each frame copies it and draws the moving parts sorted by their feet (y).
// Animation is a pure function of time (walks are positions along a path since a start
// time), so `window.__studioSetTime(ms)` freezes a frame for tests and screenshots.
import { MAP, CREW } from "./palette.js";
import * as S from "./sprites.js";

export const MAP_W = 332, MAP_H = 270;
const ROLES = ["story", "voice", "design", "animator", "reviewer"];
const ORDER = ["story", "voice", "design", "animator"];
const DEFAULT_NAMES = { story: "Quill", voice: "Echo", design: "Iris", animator: "Flip", reviewer: "Sage" };
const HOME = { story: "writers-room", voice: "booth", design: "art-room", animator: "art-room", reviewer: "review-room" };
const WALK_PX_S = 34;      // walking speed, buffer pixels per second
const FPS_MS = 1000 / 30;  // frame cap
const HOLD_MS = 1600;      // how long an errand runner stands at the destination

// ---------------------------------------------------------------------------
// layout (buffer pixels). Walls: 4 px tops; back-wall faces 16 px tall.
// ---------------------------------------------------------------------------
const FACE = 16;
export const ROOMS = {
  writers: { x: 4, y: 20, w: 160, h: 112, label: "WRITERS' ROOM", face: "wallWriters" },
  booth: { x: 168, y: 20, w: 84, h: 112, label: "RECORDING BOOTH", face: "wallBooth" },
  kitchen: { x: 256, y: 20, w: 72, h: 112, label: "KITCHEN", face: "wallKitchen" },
  art: { x: 4, y: 152, w: 160, h: 114, label: "ART & ANIMATION", face: "wallArt" },
  review: { x: 168, y: 152, w: 160, h: 114, label: "REVIEW ROOM", face: "wallReview" },
};
// door gaps: vertical walls (v) give a y range, horizontal walls (h) an x range
const DOORS = [
  { kind: "v", x: 164, y0: 108, y1: 123 }, // writers <-> booth
  { kind: "v", x: 252, y0: 108, y1: 123 }, // booth <-> kitchen
  { kind: "v", x: 164, y0: 236, y1: 251 }, // art <-> review
  { kind: "h", y: 132, x0: 128, x1: 143 }, // writers <-> art
  { kind: "h", y: 132, x0: 200, x1: 215 }, // booth <-> review
  { kind: "h", y: 132, x0: 296, x1: 311 }, // kitchen <-> review
];

// Walk graph: every edge is a straight horizontal or vertical line kept clear of furniture.
const NODES = {
  "story-desk": [56, 64], "w-a": [28, 64], "w-b": [28, 116], "visit-writers": [92, 96], "w-c": [92, 116],
  "w-d3": [136, 116],
  "b-w": [180, 116], "b-a": [180, 66], "voice-desk": [208, 66], "b-d6": [208, 116], "b-v": [236, 116],
  "visit-booth": [236, 96],
  "k-w": [268, 116], "k-r2a": [280, 116], "k-d4": [304, 116], "kitchen-animator": [280, 106],
  "kitchen-reviewer": [304, 106], "k-up": [268, 62], "kitchen-story": [268, 52], "k-m": [291, 62],
  "kitchen-voice": [291, 52], "k-r": [314, 62], "kitchen-design": [314, 52],
  "r-c": [174, 168], "r-rd": [188, 168], "review-door": [188, 184], "r-d6": [208, 168], "r-dl": [212, 168],
  "deliver": [212, 200], "r-s": [272, 168], "r-sx": [272, 196], "reviewer-desk": [243, 196], "r-d4": [304, 168],
  "r-d5": [174, 244],
  "a-d3": [136, 160], "a-d3b": [136, 244], "a-d5": [158, 244], "a-f": [127, 244], "visit-animator": [127, 224],
  "a-fx": [127, 206], "animator-desk": [104, 206], "a-vd": [64, 244], "visit-design": [64, 226], "a-i": [40, 244],
  "design-desk": [40, 204],
};
const EDGES = [
  ["story-desk", "w-a"], ["w-a", "w-b"], ["w-b", "w-c"], ["visit-writers", "w-c"], ["w-c", "w-d3"], ["w-d3", "b-w"],
  ["w-d3", "a-d3"], ["b-w", "b-a"], ["b-a", "voice-desk"], ["b-w", "b-d6"], ["b-d6", "b-v"], ["b-v", "visit-booth"],
  ["b-v", "k-w"], ["b-d6", "r-d6"], ["k-w", "k-r2a"], ["k-r2a", "k-d4"], ["k-r2a", "kitchen-animator"],
  ["k-d4", "kitchen-reviewer"], ["k-w", "k-up"], ["k-up", "kitchen-story"], ["k-up", "k-m"], ["k-m", "kitchen-voice"],
  ["k-m", "k-r"], ["k-r", "kitchen-design"], ["k-d4", "r-d4"], ["r-c", "r-rd"], ["r-rd", "review-door"],
  ["r-rd", "r-d6"], ["r-d6", "r-dl"], ["r-dl", "deliver"], ["r-dl", "r-s"], ["r-s", "r-sx"], ["r-sx", "reviewer-desk"],
  ["r-s", "r-d4"], ["r-c", "r-d5"], ["r-d5", "a-d5"], ["a-d3", "a-d3b"], ["a-d3b", "a-d5"], ["a-d3b", "a-f"],
  ["a-f", "visit-animator"], ["visit-animator", "a-fx"], ["a-fx", "animator-desk"], ["a-f", "a-vd"],
  ["a-vd", "visit-design"], ["a-vd", "a-i"], ["a-i", "design-desk"],
];
const FACING = {
  "story-desk": "down", "voice-desk": "down", "design-desk": "right", "animator-desk": "up", "reviewer-desk": "down",
  "visit-writers": "left", "visit-booth": "left", "visit-design": "left", "visit-animator": "left", deliver: "right",
  "review-door": "down",
};
const VISIT = { story: "visit-writers", voice: "visit-booth", design: "visit-design", animator: "visit-animator" };
const SEATED = new Set(["story-desk", "voice-desk", "reviewer-desk", "animator-desk"]);

/** Floor boxes [x0, y0, x1, y1] per `where` value (debug / tests). */
export const ROOM_BOXES = {
  "writers-room": ROOMS.writers, booth: ROOMS.booth, kitchen: ROOMS.kitchen, "art-room": ROOMS.art,
  "review-room": ROOMS.review, "review-door": ROOMS.review,
};
for (const k of Object.keys(ROOM_BOXES)) { const r = ROOM_BOXES[k]; ROOM_BOXES[k] = [r.x, r.y, r.x + r.w - 1, r.y + r.h - 1]; }

const ADJ = (() => {
  const a = {};
  for (const n of Object.keys(NODES)) a[n] = [];
  for (const [p, q] of EDGES) {
    const [x1, y1] = NODES[p], [x2, y2] = NODES[q];
    if (x1 !== x2 && y1 !== y2) throw new Error(`diagonal edge ${p}-${q}`);
    const d = Math.abs(x1 - x2) + Math.abs(y1 - y2);
    a[p].push([q, d]); a[q].push([p, d]);
  }
  return a;
})();

/** Shortest node path between two graph nodes (Dijkstra; the graph is tiny). */
export function route(from, to) {
  const dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(NODES));
  while (todo.size) {
    let u = null;
    for (const n of todo) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || u === to) break;
    todo.delete(u);
    for (const [v, d] of ADJ[u]) if (dist[u] + d < (dist[v] ?? Infinity)) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const out = [to];
  while (out[0] !== from && prev[out[0]]) out.unshift(prev[out[0]]);
  return out[0] === from ? out : [from, to];
}

// ---------------------------------------------------------------------------
// state -> where each agent should be
// ---------------------------------------------------------------------------
export function spotFor(role, a, st) {
  const where = a && a.where, act = a && a.activity;
  if (where === HOME[role] && ["working", "fixing", "reviewing"].includes(act)) return `${role}-desk`;
  switch (where) {
    case "review-room": return role === "reviewer" ? "reviewer-desk" : "deliver";
    case "review-door": return "review-door";
    case "writers-room": return role === "story" ? "story-desk" : "visit-writers";
    case "booth": return role === "voice" ? "voice-desk" : "visit-booth";
    case "art-room":
      if (role === "design" || role === "animator") return `${role}-desk`;
      return st && st.step === "animator" ? "visit-animator" : "visit-design";
    default: return `kitchen-${role}`;
  }
}
function agentsOf(st) {
  const out = {};
  for (const r of ROLES) {
    const a = st && st.agents && st.agents[r];
    out[r] = a && typeof a === "object"
      ? { where: String(a.where || "kitchen"), activity: String(a.activity || "idle") }
      : { where: "kitchen", activity: "idle" };
  }
  return out;
}

// ---------------------------------------------------------------------------
// background (painted once)
// ---------------------------------------------------------------------------
function floorOak(b, r) {
  const o = MAP.oak;
  for (let y = r.y; y < r.y + r.h; y++) {
    const row = Math.floor((y - r.y) / 5), j = (y - r.y) % 5;
    for (let x = r.x; x < r.x + r.w; x++) {
      const off = Math.floor(S.hash(row, 3, 11) * 30);
      const seg = Math.floor((x - r.x + off) / 34), sx = (x - r.x + off) % 34;
      const tone = S.hash(row, seg, 12) > 0.55 ? 3 : 2;
      let c = o[tone];
      if (j === 4) c = o[1];
      else if (sx === 0) c = o[1];
      else if (j === 0) c = o[Math.min(4, tone + 1)];
      else if (S.hash(x >> 2, row, 13) > 0.93) c = o[tone - 1];
      b.set(x, y, c);
    }
  }
}
function floorCarpet(b, r, ramp, step = 6) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = x - r.x, j = y - r.y;
    let c = ramp[2];
    if ((i + j) % step === 0 && (i - j + 999) % (step * 2) < step && j % 2 === 0) c = ramp[1];
    if (i % step === 3 && j % step === 3) c = ramp[3];
    b.set(x, y, c);
  }
}
function floorTiles(b, r, ramp) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = x - r.x, j = y - r.y, ti = Math.floor(i / 8), tj = Math.floor(j / 8), u = i % 8, v = j % 8;
    const light = (ti + tj) % 2 === 0;
    let c = light ? ramp[3] : ramp[2];
    if (u === 7 || v === 7) c = ramp[1];
    else if (u === 0 || v === 0) c = light ? "#fbf6ea" : ramp[3];
    b.set(x, y, c);
  }
}
const CONCRETE_HI = S.mixHex(MAP.concrete[2], MAP.concrete[3], 0.55);
function floorConcrete(b, r) {
  const c = MAP.concrete;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = x - r.x, j = y - r.y;
    // soft, wide two-tone variation (dithered only where the tones meet) + expansion joints
    const n = 0.7 * S.noise(i / 34, j / 26, 21) + 0.3 * S.noise(i / 14, j / 12, 22);
    let col = S.band(n * 1.25 - 0.2, 2, x, y, 0.18) ? CONCRETE_HI : c[2];
    if (i % 40 === 39 || j % 38 === 37) col = c[1];
    b.set(x, y, col);
  }
  // paint splatters (an art studio floor)
  const spl = ["#e8584f", "#f0c43a", "#3fa488", "#4f80d6", "#a77fd0"];
  for (let k = 0; k < 16; k++) {
    const sx = r.x + 6 + Math.floor(S.hash(k, 1, 31) * (r.w - 12)), sy = r.y + 6 + Math.floor(S.hash(k, 2, 31) * (r.h - 12));
    const col = spl[k % spl.length];
    b.set(sx, sy, col); b.set(sx + 1, sy, col); b.set(sx, sy + 1, S.mixHex(col, MAP.concrete[2], 0.3));
    if (k % 3 === 0) { b.set(sx + 3, sy - 1, col); b.set(sx - 2, sy + 2, col); }
  }
}
function wallFace(b, room) {
  const f = MAP[room.face], y0 = room.y - FACE, x0 = room.x, w = room.w;
  for (let y = y0; y < room.y; y++) for (let x = x0; x < x0 + w; x++) {
    const j = y - y0, i = x - x0;
    let c = f[2];
    if (room.face === "wallWriters") c = i % 6 === 0 ? f[1] : i % 6 === 3 && j % 4 === 1 ? f[3] : f[2];
    else if (room.face === "wallKitchen") c = i % 5 === 4 || j % 4 === 3 ? f[1] : (i + j) % 9 === 0 ? f[3] : f[2];
    else if (room.face === "wallReview") c = (i % 8 === 4 && j % 6 === 2) || (i % 8 === 0 && j % 6 === 5) ? f[3] : f[2];
    else if (room.face === "wallArt") c = S.band(0.35 + 0.5 * S.hash(i >> 3, j >> 2, 41), 2, x, y, 0.3) ? f[3] : f[2];
    b.set(x, y, c);
  }
  if (room.face === "wallBooth") S.foamWall(b, x0, y0 + 1, w, FACE - 4);
  // shadow under the ceiling lip, then a wainscot / baseboard
  b.hline(x0, x0 + w - 1, y0, f[0]); b.hline(x0, x0 + w - 1, y0 + 1, f[1]);
  if (room.face === "wallWriters" || room.face === "wallReview") {
    const wd = MAP.wainscot;
    for (let y = room.y - 6; y < room.y; y++) for (let x = x0; x < x0 + w; x++) {
      const j = y - (room.y - 6);
      b.set(x, y, j === 0 ? wd[3] : j === 5 ? wd[0] : (x - x0) % 12 === 0 ? wd[1] : j === 1 ? wd[2] : wd[2]);
    }
  } else {
    const bb = room.face === "wallKitchen" ? MAP.woodPale : MAP.wainscot;
    b.hline(x0, x0 + w - 1, room.y - 3, bb[3]); b.hline(x0, x0 + w - 1, room.y - 2, bb[2]); b.hline(x0, x0 + w - 1, room.y - 1, bb[0]);
  }
}
function wallRect(b, x, y, w, h) {
  const t = MAP.wallTop;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let c = t[1];
    if (j === 0 || i === 0) c = t[3];
    else if (j === 1 || i === 1) c = t[2];
    else if (j === h - 1 || i === w - 1) c = t[0];
    b.set(x + i, y + j, c);
  }
}

function lightPatch(b, x, y, w, h, t = 0.1) {
  // window light falling on the floor, slanting down-right (light from the top left);
  // fades out toward the bottom in two bands, dithered only where they meet
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const xx = x + i + Math.floor(j * 0.6), yy = y + j;
    const k = S.band(1 - j / h, 3, xx, yy, 0.5);
    if (k === 0) continue;
    b.tint(xx, yy, k === 2 ? t : t * 0.5, "#ffd27a");
  }
}

function paintBackground(outfit) {
  const b = new S.Buf(MAP_W, MAP_H);
  b.rect(0, 0, MAP_W, MAP_H, MAP.wallTop[1]);
  const R = ROOMS;
  floorOak(b, R.writers);
  floorCarpet(b, R.booth, MAP.carpetNavy, 6);
  floorTiles(b, R.kitchen, MAP.tile);
  floorConcrete(b, R.art);
  floorCarpet(b, R.review, MAP.carpetBlue, 8);
  for (const room of Object.values(R)) wallFace(b, room);
  // doorways: floor runs through the gap; the gap in a horizontal wall shows the lower room's floor
  for (const d of DOORS) {
    if (d.kind === "v") {
      const left = d.x < 200 && d.y0 < 132 ? R.writers : d.y0 < 132 ? R.booth : R.art;
      for (let y = d.y0; y <= d.y1; y++) for (let x = d.x; x < d.x + 4; x++) b.set(x, y, b.get(x - 4, y));
      void left;
    } else {
      for (let y = d.y; y < d.y + 4 + FACE; y++) for (let x = d.x0; x <= d.x1; x++) b.set(x, y, b.get(x, y + 4 + FACE));
    }
  }
  // wall tops
  const segs = [];
  const hWall = (y, x0, x1) => {
    let x = x0;
    for (const d of DOORS.filter((dd) => dd.kind === "h" && dd.y === y).sort((p, q) => p.x0 - q.x0)) {
      if (d.x0 > x) segs.push([x, y, d.x0 - x, 4]);
      x = d.x1 + 1;
    }
    if (x <= x1) segs.push([x, y, x1 - x + 1, 4]);
  };
  const vWall = (x, y0, y1) => {
    let y = y0;
    for (const d of DOORS.filter((dd) => dd.kind === "v" && dd.x === x && dd.y0 >= y0 && dd.y1 <= y1)) {
      if (d.y0 > y) segs.push([x, y, 4, d.y0 - y]);
      y = d.y1 + 1;
    }
    if (y <= y1) segs.push([x, y, 4, y1 - y + 1]);
  };
  hWall(0, 0, MAP_W - 1); hWall(132, 0, MAP_W - 1); hWall(266, 0, MAP_W - 1);
  vWall(0, 0, MAP_H - 1); vWall(MAP_W - 4, 0, MAP_H - 1);
  vWall(164, 0, 135); vWall(252, 0, 135); vWall(164, 132, MAP_H - 1);
  for (const s of segs) wallRect(b, ...s);
  // door frames on the horizontal-wall doors (jambs + a mat)
  for (const d of DOORS) {
    if (d.kind === "h") {
      for (let y = d.y; y < d.y + 4 + FACE; y++) { b.set(d.x0 - 1, y, MAP.wood[3]); b.set(d.x1 + 1, y, MAP.wood[1]); }
      const my = d.y + 4 + FACE + 2;
      b.rect(d.x0 + 2, my, d.x1 - d.x0 - 3, 4, MAP.rugRed[2]); b.hline(d.x0 + 2, d.x1 - 2, my, MAP.rugRed[3]);
      b.hline(d.x0 + 2, d.x1 - 2, my + 3, MAP.rugRed[1]);
    } else {
      b.hline(d.x, d.x + 3, d.y0 - 1, MAP.wood[3]); b.hline(d.x, d.x + 3, d.y1 + 1, MAP.wood[1]);
    }
  }
  // contact shadows: under each back wall and to the right of vertical walls
  for (const room of Object.values(R)) {
    b.tintRect(room.x, room.y, room.w, 1, 0.34); b.tintRect(room.x, room.y + 1, room.w, 1, 0.16);
    b.tintRect(room.x, room.y - FACE, 2, room.h + FACE, 0.22);
  }

  // ---- Writers' Room ----
  S.windowPane(b, 52, 7, 26, 11);
  lightPatch(b, 50, 22, 30, 26);
  S.corkboard(b, 88, 7, 24, 9);
  S.bookshelf(b, 9, 5, 27, 29, 1); S.castShadow(b, 9, 5, 27, 29, 0.25);
  S.bookshelf(b, 124, 5, 27, 29, 4); S.castShadow(b, 124, 5, 27, 29, 0.25);
  S.plant(b, 157, 44, 1);
  S.rug(b, 22, 86, 104, 20, MAP.rugGreen, MAP.fabricMustard[2]);
  S.chairFront(b, 56, 46);
  S.chairFront(b, 117, 46);
  const tw = S.desk(b, 96, 60, 42); S.castShadow(b, 96, 60, 42, 16);
  S.typewriter(b, 111, 63); S.papers(b, 128, 66, 2); S.mug(b, 100, 64, "#9fd8f0");
  void tw;
  S.bin(b, 81, 68); S.paperBall(b, 89, 76); S.paperBall(b, 78, 79);
  S.plant(b, 14, 128, 0);

  // ---- Recording Booth ----
  S.onAir(b, 197, 7, false);
  S.speaker(b, 172, 22); S.castShadow(b, 172, 22, 9, 15, 0.25);
  S.speaker(b, 239, 22); S.castShadow(b, 239, 22, 9, 15, 0.25);
  S.rug(b, 178, 88, 64, 18, MAP.rugRed, MAP.fabricMustard[3]);
  S.chairFront(b, 208, 48);
  S.vinylCrate(b, 234, 120);
  S.guitar(b, 176, 120);

  // ---- Kitchen ----
  S.cabinetsUpper(b, 258, 5, 40);
  S.clock(b, 303, 10);
  S.counter(b, 258, 13, 46);
  S.sink(b, 263, 14);
  S.coffeeMachine(b, 285, 4, true);
  S.mug(b, 299, 14, "#f6a8b8"); S.mug(b, 277, 14);
  S.fridge(b, 309, 3, 17, 30); S.castShadow(b, 309, 3, 17, 30, 0.2);
  S.roundTable(b, 291, 82, 11, 6);
  S.mug(b, 286, 79); S.mug(b, 295, 81, "#9fd8f0");
  S.stool(b, 309, 80);
  S.plant(b, 320, 129, 0, 7);

  // ---- Art & Animation ----
  S.paintShelf(b, 10, 146, 32);
  S.storyboard(b, 50, 140, 6);
  S.clock(b, 152, 143);
  S.rug(b, 12, 218, 50, 18, ["#2a1a3a", "#3e2a56", "#56407a", "#6e58a0"], "#f0c43a");
  S.taboret(b, 18, 206);
  S.desk(b, 84, 176, 42); S.castShadow(b, 84, 176, 42, 16);
  S.plant(b, 154, 172, 1, 5);
  S.plant(b, 14, 262, 0, 9);
  S.beanBag(b, 92, 257, MAP.fabricMustard);
  S.beanBag(b, 116, 259, ["#0e2f33", "#185250", "#247a6c", "#3fa488"]);

  // ---- Review Room ----
  S.bookshelf(b, 172, 137, 25, 26, 7);
  S.picture(b, 228, 139, 26, 10);
  S.bookshelf(b, 266, 137, 26, 26, 9);
  S.clock(b, 320, 143);
  S.chairFront(b, 243, 178);
  S.rug(b, 256, 214, 68, 40, ["#3a1e14", "#5a3020", "#7a462c", "#9a6038"], MAP.gold[2]);
  S.armchair(b, 262, 222, 1); S.armchair(b, 310, 222, -1);
  S.lowTable(b, 280, 226, 26, 9);
  S.mug(b, 285, 227); S.papers(b, 295, 230, 2);
  S.starPoster(b, 186, 212, outfit);
  S.plant(b, 236, 261, 0, 11);
  S.plant(b, 318, 207, 1, 12);
  return b;
}

// occluders: sprites people can stand behind, drawn in y order with the characters
function makeOccluders() {
  const occ = [];
  const sprite = (w, h, x, y, baseY, fn) => {
    const b = new S.Buf(w, h), off = { x, y };
    fn(b, off);
    occ.push({ buf: b, x, y, baseY });
  };
  // Quill's desk with a laptop, mug and papers
  sprite(60, 32, 30, 50, 77, (b) => {
    S.desk(b, 6, 10, 42);
    S.laptopBack(b, 21, 8);
    S.papers(b, 37, 15, 3);
    S.lamp(b, 42, 3);
    S.mug(b, 10, 12);
  });
  // Echo's desk with the mixing console
  sprite(60, 32, 180, 52, 79, (b) => {
    S.desk(b, 6, 10, 44);
    S.consoleDesk(b, 9, 12, null);
  });
  // Sage's desk: papers, stamp pad, lamp
  sprite(60, 34, 216, 180, 209, (b) => {
    S.desk(b, 6, 12, 44);
    S.papers(b, 9, 16, 4);
    S.stampPad(b, 37, 16);
    S.lamp(b, 44, 6);
  });
  // Flip's chair (he sits facing his monitors)
  sprite(16, 18, 96, 198, 214, (b) => S.chairBack(b, 8, 2));
  return occ;
}

// ---------------------------------------------------------------------------
// the moving world
// ---------------------------------------------------------------------------
function makeAgent(role, spot) {
  return { role, node: spot, spot, path: null, legs: [], hold: null, dir: FACING[spot] || "down", carry: null };
}

function pathLength(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
  return n;
}
function along(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (d <= seg) {
      const u = seg ? d / seg : 1;
      const dir = x1 > x0 ? "right" : x1 < x0 ? "left" : y1 > y0 ? "down" : "up";
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, seg: i, dir };
    }
    d -= seg;
  }
  const [x, y] = pts[pts.length - 1];
  return { x, y, seg: pts.length - 1, dir: null, done: true };
}

export class World {
  constructor(outfit = "blazer") {
    this.reduced = false;
    this.outfit = outfit;
    this.bg = paintBackground(outfit);
    this.occ = makeOccluders();
    this.frame = new S.Buf(MAP_W, MAP_H);
    this.agents = {};
    for (const r of ROLES) this.agents[r] = makeAgent(r, `kitchen-${r}`);
    this.api = agentsOf(null);
    this.st = null;
    this.run = undefined;
    this.seen = new Map(); // event key -> how many times it has been seen (max over polls)
    this.triggered = 0;     // stamps + errands started by new events (for tests)
    this.stamps = [];   // {role:"reviewer", text, t0}
    this.names = { ...DEFAULT_NAMES };
  }

  speed() { return WALK_PX_S * (this.reduced ? 0.7 : 1); }

  /** Where an agent is at time t: {x, y, dir, walking, carry}. Advances finished legs. */
  pos(a, t) {
    for (;;) {
      if (a.path) {
        const p = along(a.path.pts, ((t - a.path.t0) / 1000) * this.speed());
        if (!p.done) return { x: p.x, y: p.y, dir: p.dir, walking: true, carry: a.path.carry, seg: p.seg };
        // arrived
        a.node = a.path.nodes[a.path.nodes.length - 1];
        const arrivedAt = a.path.t0 + (pathLength(a.path.pts) / this.speed()) * 1000;
        const leg = a.path.leg;
        a.path = null;
        a.dir = FACING[a.node] || "down";
        if (leg && leg.holdMs) a.hold = { until: arrivedAt + leg.holdMs, carry: leg.carry };
        if (a.legs.length && !(a.hold && a.hold.until > t)) { a.hold = null; this.startLeg(a, a.legs.shift(), arrivedAt + (leg && leg.holdMs ? leg.holdMs : 0)); continue; }
      }
      if (a.hold && a.hold.until <= t) {
        const until = a.hold.until;
        a.hold = null;
        if (a.legs.length) { this.startLeg(a, a.legs.shift(), until); continue; }
      }
      const [x, y] = NODES[a.node];
      return { x, y, dir: a.dir, walking: false, carry: a.hold ? a.hold.carry : null };
    }
  }

  startLeg(a, leg, t0) {
    if (leg.to === a.node) { if (leg.holdMs) a.hold = { until: t0 + leg.holdMs, carry: leg.carry }; return; }
    const nodes = route(a.node, leg.to);
    a.path = { nodes, pts: nodes.map((n) => NODES[n]), t0, carry: leg.carry || null, leg };
  }

  /** Send an agent somewhere (possibly mid-walk): new route from the node it is heading to. */
  goTo(a, t, legs) {
    const p = this.pos(a, t);
    a.hold = null;
    if (a.path) {
      const next = a.path.nodes[p.seg];
      const rest = route(next, legs[0].to);
      a.path = { nodes: rest, pts: [[p.x, p.y], ...rest.map((n) => NODES[n])], t0: t, carry: legs[0].carry || null, leg: legs[0] };
      a.legs = legs.slice(1);
    } else {
      a.legs = legs.slice(1);
      this.startLeg(a, legs[0], t);
    }
  }

  /** Feed the latest /api/state (or null). */
  update(st, t) {
    const runKey = st ? String(st.run || "") : null;
    const fresh = runKey !== this.run && (st || this.run === undefined);
    if (st && st.team) for (const r of ROLES) if (st.team[r] && st.team[r].name) this.names[r] = String(st.team[r].name);
    const outfit = st && st.presenterOutfit === "labcoat" ? "labcoat" : "blazer";
    if (outfit !== this.outfit) { this.outfit = outfit; this.bg = paintBackground(outfit); }
    const api = agentsOf(st);
    const events = st && Array.isArray(st.events) ? st.events : [];
    // The API sends a sliding window of the last events, so indexes shift once a run has more:
    // key on content only and count repeats, so an event is new only when its key now occurs
    // more often than it ever did before.
    const keyOf = (e) => (e && typeof e === "object" ? `${e.time}|${e.agent}|${e.kind}|${e.text}` : String(e));
    const counts = new Map();
    for (const e of events) { const k = keyOf(e); counts.set(k, (counts.get(k) || 0) + 1); }
    if (fresh) {
      // a new run (or the first look): everyone simply is where the state says; carriers walk
      this.run = runKey;
      this.seen = new Map(counts);
      this.stamps = [];
      for (const r of ROLES) {
        const a = this.agents[r], spot = spotFor(r, api[r], st);
        a.path = null; a.legs = []; a.hold = null;
        if (api[r].activity === "carrying") {
          a.node = r === "reviewer" ? "reviewer-desk" : `${r}-desk`;
          a.spot = spot;
          this.goTo(a, t, [{ to: spot, carry: r === "reviewer" ? "fix" : "paper" }]);
        } else { a.node = spot; a.spot = spot; a.dir = FACING[spot] || "down"; }
      }
      this.api = api; this.st = st;
      return;
    }
    // new events -> stamps and hand-off errands
    const errands = {};
    const added = new Map();
    for (const [k, n] of counts) {
      const before = this.seen.get(k) || 0;
      if (n > before) { added.set(k, n - before); this.seen.set(k, n); }
    }
    // the newest occurrences of each key are the new ones
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i], k = keyOf(e);
      if (!added.get(k)) continue;
      added.set(k, added.get(k) - 1);
      if (!e || typeof e !== "object") continue;
      if (e.kind === "pass" || e.kind === "fix") {
        this.stamps.push({ text: e.kind === "pass" ? "PASS" : "FIX", t0: t });
        this.triggered++;
      }
      if (e.kind === "handoff" && ORDER.includes(e.agent)) {
        const giver = ORDER[ORDER.indexOf(e.agent) - 1];
        if (giver && !errands[giver]) { errands[giver] = VISIT[e.agent]; this.triggered++; }
      }
    }
    for (const r of ROLES) {
      const a = this.agents[r], spot = spotFor(r, api[r], st);
      const carry = api[r].activity === "carrying" ? (r === "reviewer" ? "fix" : "paper") : null;
      if (errands[r] && errands[r] !== spot) {
        this.goTo(a, t, [{ to: errands[r], carry: "paper", holdMs: HOLD_MS }, { to: spot, carry }]);
        a.spot = spot;
      } else if (spot !== a.spot) {
        this.goTo(a, t, [{ to: spot, carry }]);
        a.spot = spot;
      }
    }
    this.api = api; this.st = st;
  }

  debug(t) {
    const out = {};
    for (const r of ROLES) {
      const p = this.pos(this.agents[r], t);
      out[r] = { ...this.api[r], x: Math.round(p.x), y: Math.round(p.y), walking: p.walking, dir: p.dir };
    }
    out.triggered = this.triggered;
    out.rooms = ROOM_BOXES;
    return out;
  }

  /** Render the buffer for time t; returns the list of name tags/stamps for the text layer. */
  render(t) {
    const b = this.frame, rm = this.reduced, slow = rm ? 0.4 : 1;
    b.d.set(this.bg.d);
    const f4 = (ms, phase = 0) => Math.floor((t * slow) / ms + phase) & 3;
    const working = (r) => this.agents[r].node === `${r}-desk` && !this.agents[r].path
      && ["working", "fixing", "reviewing"].includes(this.api[r].activity);

    // --- animated props that sit on the background layer ---
    S.onAir(b, 197, 7, working("voice"));
    if (working("voice")) for (let i = 0; i < 3; i++) b.tint(205 + i * 8, 17, 0.25, "#ff6a4a");
    this.drawMonitors(b, t, working("animator"), slow);
    const items = [];
    for (const o of this.occ) items.push({ y: o.baseY, draw: () => b.blit(o.buf, o.x, o.y) });
    // easel (painting grows while Iris works)
    const paint = working("design") ? 0.25 + 0.75 * (((t * slow) / 14000) % 1) : 1;
    items.push({ y: 206, draw: () => S.easel(b, 46, 178, paint) });
    items.push({ y: 79.5, draw: () => { S.micBoom(b, 215, 50); this.drawConsole(b, t, working("voice"), slow); } });

    const tags = [];
    for (const r of ROLES) {
      const a = this.agents[r], p = this.pos(a, t), act = this.api[r].activity;
      const x = Math.round(p.x), y = Math.round(p.y);
      let pose = "stand", frame = 0, dy = 0, mouth = false, dir = p.dir || a.dir || "down";
      const extra = [];
      if (p.walking) {
        pose = p.carry ? "carry" : "walk";
        frame = Math.floor(t / 150) & 3;
        if (p.carry) extra.push(() => S.heldPaper(b, r, x, y, dir, p.carry === "fix"));
      } else if (p.carry) {
        pose = "hold";
        extra.push(() => S.heldPaper(b, r, x, y, dir, p.carry === "fix"));
      } else if (working(r)) {
        ({ pose, mouth } = this.workPose(r, t, slow, extra, x, y));
      } else if (act === "carrying") {
        pose = "hold";
        extra.push(() => S.heldPaper(b, r, x, y, dir, r === "reviewer"));
      } else if (act === "celebrating") {
        pose = "up";
        const hop = [0, 2, 4, 2][f4(rm ? 260 : 130, r.length * 0.7)];
        dy = -(rm ? Math.min(hop, 1) : hop);
        if (!rm) extra.push(() => this.confetti(b, x, y, t, r));
      } else if (act === "alarm") {
        extra.push(() => S.alarmFlag(b, x, y, dir, f4(220)));
      } else if (act === "waiting") {
        const bob = rm ? 0 : Math.round(Math.sin((t / 600) * Math.PI) * 1);
        extra.push(() => S.exclaim(b, x, y - 29 + bob)); // the name tag moves above it
      } else if (a.node.startsWith("kitchen-")) {
        const cyc = ((t * slow) / 1000 + r.length * 0.9) % 4.2;
        const sip = cyc > 3.2;
        extra.push(() => { S.heldMug(b, r, x, y, dir, sip); if (!sip) S.steam(b, x + 4, y - 7, t * slow); });
      }
      const seatedHere = SEATED.has(a.node) && !p.walking && !p.carry && a.node === `${r}-desk`;
      if (seatedHere && pose === "stand") pose = "seat";
      if (seatedHere && dir !== "up") dy -= 2; // sit up so the shoulders clear the desk
      items.push({
        y: y + (seatedHere ? -0.5 : 0),
        draw: () => {
          if (!seatedHere) S.footShadow(b, x, y);
          S.drawCharacter(b, r, x, y + dy, dir, pose, frame, mouth);
          for (const fn of extra) fn();
        },
      });
      // tags sit above the head, or above the raised flag / the "!" bubble
      const lift = p.walking ? (r === "design" ? 19 : 17) : act === "alarm" ? 31 : act === "waiting" ? 33 : r === "design" ? 19 : 17;
      tags.push({ role: r, name: clampName(this.names[r]), x, y: y + dy - lift, color: CREW[r].tag });
    }
    // overlays that sit on desks in front of the seated person
    if (working("story")) items.push({ y: 77.5, draw: () => this.typing(b, t, slow) });
    if (working("reviewer")) items.push({ y: 209.5, draw: () => this.magnify(b, t, slow) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
    if (working("story") && this.api.story.activity === "fixing") this.paperToss(b, t, slow);
    if (working("design")) this.swatches(b, t, slow);
    if (working("voice")) this.soundWaves(b, t, slow);

    const stamps = this.stamps.filter((s) => t - s.t0 < 3500);
    this.stamps = stamps;
    const sage = this.pos(this.agents.reviewer, t);
    return { tags, stamps: stamps.map((s) => ({ ...s, x: sage.x, y: sage.y - 24, age: t - s.t0 })) };
  }

  workPose(r, t, slow, extra, x, y) {
    const b = this.frame;
    if (r === "voice") return { pose: "seat", mouth: (Math.floor((t * slow) / 170) % 3) !== 0 };
    if (r === "design") {
      const k = Math.floor((t * slow) / 220) & 3;
      extra.push(() => {
        // brush hand on the canvas, moving in short strokes
        const bx = x + 5 + (k & 1), by = y - 10 - [0, 1, 2, 1][k];
        b.set(bx, by, CREW.design.skin[2]); b.set(bx + 1, by - 1, "#6a4426"); b.set(bx + 2, by - 2, "#e8584f");
        b.set(bx, by + 1, S.mixHex(CREW.design.skin[1], MAP.outline, 0.3));
      });
      return { pose: "hold", mouth: false };
    }
    if (r === "animator") {
      const k = Math.floor((t * slow) / 260) & 1;
      extra.push(() => { b.set(x - 4 + k, y - 13, CREW.animator.skin[2]); b.set(x + 4 - k, y - 13, CREW.animator.skin[2]); });
      return { pose: "seat", mouth: false };
    }
    return { pose: "seat", mouth: false };
  }

  typing(b, t, slow) {
    const k = Math.floor((t * slow) / 140) & 3, skin = CREW.story.skin;
    const hands = [[51, 63 - (k === 0 ? 1 : 0)], [60, 63 - (k === 2 ? 1 : 0)]];
    for (const [hx, hy] of hands) {
      b.set(hx, hy, skin[2]); b.set(hx + 1, hy, skin[1]);
      b.set(hx, hy + 1, S.mixHex(skin[1], MAP.outline, 0.5)); b.set(hx + 1, hy + 1, S.mixHex(skin[1], MAP.outline, 0.5));
    }
    if (k === 1) b.set(56, 60, "#fffaee");
  }

  paperToss(b, t, slow) {
    const cyc = ((t * slow) / 2600) % 1;
    if (cyc > 0.32) return;
    const u = cyc / 0.32, x0 = 62, y0 = 54, x1 = 84, y1 = 66;
    const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 12;
    S.paperBall(b, Math.round(x), Math.round(y));
  }

  magnify(b, t, slow) {
    const u = ((t * slow) / 2400) % 1, k = u < 0.5 ? u * 2 : 2 - u * 2;
    b.rect(232, 193, 14, 6, MAP.paper[3]);
    for (let i = 0; i < 3; i++) b.hline(234, 243 - (i % 2) * 3, 194 + i * 2, "#8a93a8");
    S.selout(b, 231, 192, 16, 8, MAP.paper[0]);
    S.magnifier(b, 231 + Math.round(k * 9), 190);
  }

  drawConsole(b, t, on, slow) {
    const lv = [0, 1, 2, 3, 4, 5].map((i) => on ? 0.5 + 0.5 * Math.sin((t * slow) / (130 + i * 37) + i) : 0);
    S.consoleDesk(b, 189, 64, lv.map((v) => Math.max(0, v)));
  }

  drawMonitors(b, t, on, slow) {
    const scr = [S.monitor(b, 88, 165, 15, 10), S.monitor(b, 107, 165, 15, 10)];
    const [m1, m2] = scr, s = MAP.screen;
    if (!on) {
      for (const m of scr) { b.rect(m.x, m.y, m.w, m.h, s[0]); b.set(m.x + 1, m.y + 1, s[1]); }
      return;
    }
    // monitor 1: flipbook, a bouncing ball (4 frames) with onion-skin ghosts
    b.rect(m1.x, m1.y, m1.w, m1.h, "#f6f0e2");
    const k = Math.floor((t * slow) / 160) & 3, bx = m1.x + 2 + k * 3, by = m1.y + [5, 2, 1, 3][k];
    b.hline(m1.x, m1.x + m1.w - 1, m1.y + m1.h - 1, "#c8b8a0");
    for (let g = 1; g <= 2; g++) b.set(bx - g * 3, m1.y + [5, 2, 1, 3][(k - g + 4) & 3], "#e0c8b8");
    b.rect(bx, by, 2, 2, "#e8584f"); b.set(bx, by, "#ff9a86");
    // monitor 2: render bar filling up
    b.rect(m2.x, m2.y, m2.w, m2.h, s[1]);
    const prog = ((t * slow) / 6000) % 1, fill = Math.floor(prog * (m2.w - 2));
    b.hline(m2.x + 1, m2.x + m2.w - 2, m2.y + 4, s[0]);
    b.hline(m2.x + 1, m2.x + fill, m2.y + 4, "#7cffa0");
    b.hline(m2.x + 1, m2.x + 6, m2.y + 1, s[3]); b.hline(m2.x + 1, m2.x + 4, m2.y + 2, s[2]);
    for (let i = 0; i < 3; i++) b.rect(m2.x + 1 + i * 4, m2.y + 6 - 0, 3, 1, i <= prog * 3 ? s[3] : s[0]);
  }

  swatches(b, t, slow) {
    const cols = ["#e8584f", "#f0c43a", "#3fa488", "#4f80d6", "#a77fd0"];
    const k = Math.floor((t * slow) / 700), slots = [[48, 170], [56, 167], [64, 170]];
    for (let i = 0; i < 3; i++) {
      const age = ((t * slow) / 700) - (k - i);
      if (age > 2.6) continue;
      const [sx, sy] = slots[(k - i + 300) % 3], c = cols[(k - i + 500) % cols.length];
      const sz = age < 0.25 ? 1 : 3;
      b.rect(sx, sy - Math.floor(age), sz, sz, c);
      if (sz === 3) { b.set(sx, sy - Math.floor(age), S.mixHex(c, "#ffffff", 0.45)); S.selout(b, sx - 1, sy - Math.floor(age) - 1, 5, 5, S.mixHex(c, MAP.outline, 0.6)); }
    }
  }

  soundWaves(b, t, slow) {
    const u = ((t * slow) / 900) % 1;
    for (let w = 0; w < 2; w++) {
      const r = 2 + Math.floor(((u + w * 0.5) % 1) * 6);
      for (let j = -r; j <= r; j++) {
        const i = Math.round(Math.sqrt(Math.max(0, r * r - j * j)));
        if (Math.abs(j) < r - 0) b.tint(219 + i, 53 + j, 0.55 - r * 0.05, "#9fd8f0");
      }
    }
  }

  confetti(b, x, y, t, r) {
    const cols = ["#e8584f", "#f0c43a", "#3fa488", "#4f80d6", "#a77fd0", "#ffffff"];
    for (let i = 0; i < 6; i++) {
      const seed = S.hash(i, r.length, 77), period = 1400 + seed * 600;
      const u = ((t + seed * period) % period) / period;
      const cx = x - 9 + Math.floor(S.hash(i, 9, r.length) * 18) + Math.round(Math.sin(u * 7 + i) * 2);
      const cy = y - 30 + Math.floor(u * 28);
      b.set(cx, cy, cols[(i + r.length) % cols.length]);
    }
  }
}

// ---------------------------------------------------------------------------
// DOM: canvas sizing, frame loop, text layer
// ---------------------------------------------------------------------------
/** Name tags stay short: at most 10 characters, ending with "…" when cut. */
export const clampName = (n) => { const c = [...String(n)]; return c.length > 10 ? c.slice(0, 9).join("") + "…" : c.join(""); };

const FONT = 'ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", Menlo, monospace';

/** Start the studio on a canvas; getState() returns the latest /api/state (or null). */
export function startStudio(canvas, getState) {
  const world = new World();
  const frameCv = document.createElement("canvas");
  frameCv.width = MAP_W; frameCv.height = MAP_H;
  const fctx = frameCv.getContext("2d");
  const img = fctx.createImageData(MAP_W, MAP_H);
  const view = new Uint32Array(img.data.buffer);
  const ctx = canvas.getContext("2d");
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let frozen = null, lastState, last = -1e9, geo = null;
  const now = () => (frozen === null ? performance.now() : frozen);

  function resize() {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const s = Math.max(1, Math.floor(Math.min(canvas.width / MAP_W, canvas.height / MAP_H)));
    geo = { s, ox: Math.floor((canvas.width - MAP_W * s) / 2), oy: Math.floor((canvas.height - MAP_H * s) / 2), dpr };
  }

  function voidBg() {
    const { s } = geo;
    ctx.fillStyle = MAP.void; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = MAP.voidDot;
    const step = 8 * s;
    for (let y = (geo.oy % step) - step; y < canvas.height; y += step)
      for (let x = (geo.ox % step) - step; x < canvas.width; x += step) ctx.fillRect(x + step / 2, y + step / 2, s, s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(geo.ox + 2 * s, geo.oy + 2 * s, MAP_W * s, MAP_H * s); // drop shadow
  }

  function chip(x, y, text, fs, bg, fg, accent) {
    ctx.font = `700 ${fs}px ${FONT}`;
    const tw = Math.ceil(ctx.measureText(text).width), pad = Math.round(fs * 0.4), h = Math.round(fs * 1.35);
    const bx = Math.round(x - tw / 2 - pad), by = Math.round(y - h);
    ctx.fillStyle = MAP.outline; ctx.fillRect(bx - 2, by - 2, tw + pad * 2 + 4, h + 4);
    ctx.fillStyle = bg; ctx.fillRect(bx, by, tw + pad * 2, h);
    if (accent) { ctx.fillStyle = accent; ctx.fillRect(bx, by + h - Math.max(2, fs >> 3), tw + pad * 2, Math.max(2, fs >> 3)); }
    ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText(text, Math.round(x), Math.round(by + h / 2 - (accent ? 1 : 0)));
    return { x: bx - 2, y: by - 2, w: tw + pad * 2 + 4, h: h + 4 };
  }

  function draw(t) {
    world.reduced = !!(mq && mq.matches);
    const st = getState();
    if (st !== lastState) { world.update(st, t); lastState = st; }
    const { tags, stamps } = world.render(t);
    view.set(world.frame.d);
    fctx.putImageData(img, 0, 0);
    voidBg();
    const { s, ox, oy } = geo;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameCv, ox, oy, MAP_W * s, MAP_H * s);
    // room labels on the wall tops
    const lf = Math.max(12, Math.round(s * 4.2));
    for (const room of Object.values(ROOMS)) {
      ctx.font = `700 ${lf}px ${FONT}`;
      const w = ctx.measureText(room.label).width;
      // chip sits on the wall top, clamped inside the map so the top row is never cut
      const top = Math.max(oy + 4, oy + (room.y - FACE - 4) * s + 2);
      chip(ox + (room.x + 2) * s + w / 2 + lf * 0.4 + 2, top + Math.round(lf * 1.35) + 2, room.label, lf, MAP.labelBg, MAP.label, null);
    }
    // name tags, nudged up when they would overlap
    const tf = Math.max(12, Math.round(s * 4.6)), placed = [];
    for (const tg of [...tags].sort((p, q) => q.y - p.y)) {
      let y = oy + tg.y * s - 2;
      ctx.font = `700 ${tf}px ${FONT}`;
      const w = ctx.measureText(tg.name).width + tf;
      const x = ox + tg.x * s;
      for (let k = 0; k < 4; k++) {
        const hit = placed.find((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 2 && Math.abs(p.y - y) < tf * 1.4 + 4);
        if (!hit) break;
        y = hit.y - tf * 1.4 - 5;
      }
      placed.push({ x, y, w });
      chip(x, y, tg.name, tf, MAP.tagBg, MAP.tagText, tg.color);
    }
    // PASS / FIX stamps above Sage
    for (const sp of stamps) {
      const fs = Math.max(16, Math.round(s * 7));
      const pop = world.reduced ? 1 : Math.min(1, sp.age / 180);
      const alpha = sp.age > 2800 ? Math.max(0, 1 - (sp.age - 2800) / 700) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ox + sp.x * s, oy + sp.y * s);
      ctx.rotate(-0.12);
      ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
      const col = sp.text === "PASS" ? "#2f9a44" : "#c8323a";
      ctx.font = `900 ${fs}px ${FONT}`;
      const w = ctx.measureText(sp.text).width + fs * 0.8;
      ctx.fillStyle = "#fffaf0"; ctx.fillRect(-w / 2, -fs * 0.75, w, fs * 1.5);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, s); ctx.strokeRect(-w / 2 + 2, -fs * 0.75 + 2, w - 4, fs * 1.5 - 4);
      ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(sp.text, 0, 1);
      ctx.restore();
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) return; // nothing to see: skip the work in a background tab
    const t = now();
    if (frozen === null && t - last < FPS_MS) return;
    last = t;
    if (!geo) resize();
    draw(t);
  }

  window.__studioDebug = () => world.debug(now());
  window.__studioSetTime = (ms) => { frozen = ms === null || ms === undefined ? null : Number(ms); if (!geo) resize(); draw(now()); };
  window.addEventListener("resize", () => { resize(); draw(now()); });
  resize();
  draw(now());
  requestAnimationFrame(loop);
  return world;
}
