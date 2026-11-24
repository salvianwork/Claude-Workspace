// Pixel drawing for the studio map: a tiny pixel buffer, the five crew characters
// (templates + automatic rim light and sel-out outline) and every furniture / prop sprite.
//
// Art rules follow Codixel (https://github.com/mankidev/codixel, MIT, (c) 2026 mankidev):
// hue-shifted ramps per material, outlines taken from the sprite's own darkest ramp colour
// with a 1-px rim light on the lit (top-left) side, dither only where two bands meet.
// The Bayer matrix, band() and hash() below are adapted from Codixel's core/pixel.js (MIT).
// The MIT permission notice applies to that code: https://github.com/mankidev/codixel/blob/main/LICENSE
import { MAP, CREW, PRESENTER } from "./palette.js";

// ---------------------------------------------------------------------------
// colours & buffer
// ---------------------------------------------------------------------------
const U32 = new Map();
/** "#rrggbb" -> opaque ABGR uint32 (canvas ImageData byte order on little-endian). */
export function u32(hex) {
  if (typeof hex === "number") return hex;
  let v = U32.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    U32.set(hex, v);
  }
  return v;
}
export function mixU(a, b, t) {
  const r = (a & 255) + (((b & 255) - (a & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  return (0xff000000 | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
export const mixHex = (a, b, t) => {
  const v = mixU(u32(a), u32(b), t);
  return "#" + [v & 255, (v >> 8) & 255, (v >> 16) & 255].map((c) => c.toString(16).padStart(2, "0")).join("");
};

const BT = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** Bayer threshold at a pixel (Codixel). */
export const bt = (x, y) => BT[((y & 3) << 2) | (x & 3)];
/** Value 0..1 -> one of n flat bands, dithered only in a thin strip at each band edge (Codixel P.band). */
export function band(v, n, x, y, strip = 1 / 3) {
  const f = Math.min(1, Math.max(0, v)) * (n - 1), k = Math.floor(f), fr = f - k;
  return Math.min(n - 1, k + (bt(x, y) < Math.min(1, Math.max(0, (fr - 0.5) / strip + 0.5)) ? 1 : 0));
}
/** Deterministic hash 0..1 (Codixel P.hash). */
export function hash(a, b, s = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = u32(c);
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  /** Blend the existing pixel toward a colour (shadows, glows). */
  tint(x, y, t, to = MAP.shadow) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.d[i]) this.d[i] = mixU(this.d[i], u32(to), t);
  }
  tintRect(x, y, w, h, t, to) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.tint(x + i, y + j, t, to); }
  /** Copy the opaque pixels of another buffer. */
  blit(src, dx, dy) {
    dx = Math.round(dx); dy = Math.round(dy);
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x], tx = x + dx;
        if (c && tx >= 0 && tx < this.w) this.d[ty * this.w + tx] = c;
      }
    }
  }
}

/** Give every transparent pixel next to the shape an outline (sel-out: lit side lighter). */
export function selout(b, x0 = 0, y0 = 0, w = b.w, h = b.h, dark = MAP.outline) {
  const src = b.d.slice(), W = b.w, at = (x, y) => (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h ? 0 : src[y * W + x]);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (at(x, y)) continue;
    const r = at(x + 1, y), d = at(x, y + 1), l = at(x - 1, y), u = at(x, y - 1);
    const n = l || u || r || d;
    if (!n) continue;
    const lit = !l && !u && (r || d); // we are on the top/left side of the shape
    b.d[y * W + x] = mixU(n, u32(dark), lit ? 0.62 : 0.8);
  }
}

// ---------------------------------------------------------------------------
// tiny 3x5 pixel font (signs, poster plate)
// ---------------------------------------------------------------------------
const GLYPHS = {
  A: "010101111101101", I: "111010010010111", N: "110101101101101", O: "010101101101010",
  R: "110101110101101", S: "011100010001110", T: "111010010010010", P: "110101110100100",
  F: "111100110100100", X: "101101010101101", "!": "010010010000010", " ": "000000000000000",
};
export function pixText(b, x, y, text, col) {
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let i = 0; i < 15; i++) if (g[i] === "1") b.set(x + (i % 3), y + Math.floor(i / 3), col);
    x += 4;
  }
}

// ---------------------------------------------------------------------------
// characters: 16x20 cells, feet at (8, 18); the visible body is ~10x16 with outline
// ---------------------------------------------------------------------------
const CODES = {
  m: ["skin", 0], z: ["skin", 1], k: ["skin", 2], K: ["skin", 3],
  g: ["hair", 0], j: ["hair", 1], h: ["hair", 2], H: ["hair", 3],
  r: ["top", 0], u: ["top", 1], t: ["top", 2], T: ["top", 3],
  v: ["top2", 1], w: ["top2", 2], W: ["top2", 3],
  q: ["pants", 1], p: ["pants", 2], P: ["pants", 3],
  b: ["shoe", 0], n: ["shoe", 1], N: ["shoe", 2],
  y: ["acc", 0], x: ["acc", 1], a: ["acc", 2], A: ["acc", 3],
  e: ["eye", 0], "+": ["blush", 0],
};
const NO_RIM = new Set(["e", "+", "m", "a", "A"]);

// Heads: 10 wide (the head itself is the middle 8), rows 0-1 are for hats, chin on row 8,
// rows 9+ (long hair, beard) lie over the body. Placed at cell (3, 2).
const HEADS = {
  story: {
    down: ["", "", "..hHHhhj..", ".hHHhhhhj.", ".hHhhhhjj.", ".hkxKkxzj.", ".haeaaeaj.", ".kKkkkkzz.", "..kkkkzz.."],
    up: ["", "", "..hHHhhj..", ".hHHhhhhj.", ".hHhhhhhj.", ".hhhhhhjj.", ".xhhhhhjx.", ".jhhhhhjj.", "..zkkkzz.."],
    side: ["", "", "..hHHhh...", ".hHHhhhh..", ".hHhhhhhh.", ".hhhhkKkk.", ".hhxxaeak.", ".jhjkkkkz.", "..jzkkkz.."],
  },
  voice: {
    down: ["", "", "..haAAah..", ".xhHhHhjx.", ".xHhHhhjx.", ".AkKkkkzx.", "aAkekkezxy", ".akkkkkzx.", "..zkkkzz.."],
    up: ["", "", "..haAAah..", ".xhHhHhjx.", ".xhHhhhjx.", ".Ahhhhhjx.", "aAhhhhhjxy", ".ajhhhjjx.", "..zkkkzz.."],
    side: ["", "", "..hHhHh...", ".hHhaAhh..", ".hhHaAhhh.", ".hhaAAkKk.", ".hhaAAkek.", ".jhxaxkkz.", "..jzkkkz.."],
  },
  design: {
    down: ["....aAa...", "..aAAAAa..", ".xaaaaaaay", ".hHhhhhhj.", ".hHHhhhjj.", ".hkKkkkzj.", ".hkekkezj.", ".h+kkkk+j.",
      ".hzkkkzzj.", ".hj....jj.", ".j......j."],
    up: ["....aAa...", "..aAAAAa..", ".xaaaaaaay", ".hHhhhhhj.", ".hHhhhhhj.", ".hHhhhhjj.", ".hhhhhhjj.", ".hhhhhhjj.",
      ".jhhhhhjj.", ".jhhhhhjj.", "..jhhhjj.."],
    side: ["...aAa....", ".aAAAAa...", ".xaaaaaay.", ".hHhhhhh..", ".hHhhhhhh.", ".hhhhkKkk.", ".hhhjkkek.", ".hhj+kkkz.",
      ".hhj.zkz..", ".hj.......", ".j........"],
  },
  animator: {
    down: ["", "...yxxy...", "..aAAAax..", ".aAAAaaax.", ".xahHhaxx.", ".hkKkkkzj.", ".hkekkezj.", ".kKkkkkzz.", "..kkkkzz.."],
    up: ["", "", "..aAAAax..", ".aAAAaaax.", ".xAAaaaax.", ".yxxxxxxy.", ".hhhhhhjj.", ".jhhhhhjj.", "..zkkkzz.."],
    side: ["", "", "...aAAAx..", "..aAAAaax.", "yxxaaaaax.", "..hhhkKkk.", "..hhjkkek.", "..jhzkkkz.", "...jzkkz.."],
  },
  reviewer: {
    down: ["", "", "..hHHhhj..", ".hHKKkkhj.", ".hkKkkkzj.", ".hkHkkHzj.", ".hkekkezj.", ".hkHhhjzj.", "..hHhhjj..", "...hhj...."],
    up: ["", "", "..hHkKhj..", ".hHkKkhhj.", ".hHhhhhhj.", ".hhhhhhjj.", ".hhhhhhjj.", ".jhhhhhjj.", "..zkkkzz.."],
    side: ["", "", "..hHHhh...", ".hHKKkkk..", ".hhhkKkkk.", ".hhhkkHkk.", ".hhjzkkek.", ".hhjhHhhk.", "..jhHhhj..", "....hhj..."],
  },
};

// Bodies: 4 torso rows + 3 leg rows, 10 wide, placed at cell (3, 11).
const TORSO = {
  down: {
    story: [".tTTWwtuu.", ".tTtWwtuu.", ".kTtwwtuz.", "..pPppqq.."],
    voice: [".tTTTttuu.", ".tTwttwuu.", ".kTuuuuuz.", "..pPppqq.."],
    design: [".tTTTttuu.", ".tTWwwvuu.", ".kTWwwvuz.", "..pWwwvq.."],
    animator: [".tTTTttuu.", ".kTTtttuz.", ".kTttttuz.", "..pPppqq.."],
    reviewer: [".tTTWwtuu.", ".tTTtttuu.", ".kTttttuz.", "..pPppqq.."],
  },
  up: {
    default: [".tTTTttuu.", ".tTTtttuu.", ".kTttttuz.", "..pPppqq.."],
    animator: [".tTTTttuu.", ".kTTtttuz.", ".kTttttuz.", "..pPppqq.."],
    voice: [".tTTTTtuu.", ".tTTtttuu.", ".kTttttuz.", "..pPppqq.."],
  },
  side: {
    default: ["...tTTtu..", "...tTTuu..", "...uKkuu..", "...pPpq..."],
    animator: ["...tTTtu..", "...tKkuu..", "...uKkuu..", "...pPpq..."],
    design: ["...tTTtu..", "...WTTuu..", "...WKkuu..", "...pWpq..."],
  },
};
const LEGS = {
  down: [["...Ppqq...", "...Ppqq...", "...Nnnb..."], ["...Ppqq...", "...Nnqq...", ".....nb..."],
    ["...Ppqq...", "...Ppqq...", "...Nnnb..."], ["...Ppqq...", "...Ppnb...", "...Nn....."]],
  up: [["...Ppqq...", "...Ppqq...", "...nnbb..."], ["...Ppqq...", "...nnqq...", ".....bb..."],
    ["...Ppqq...", "...Ppqq...", "...nnbb..."], ["...Ppqq...", "...Ppbb...", "...nn....."]],
  side: [["...pPpq...", "...pPpq...", "...nNNbb.."], ["...pPpqq..", "..pP..qq..", ".nN...nNb."],
    ["...pPpq...", "...pPpq...", "...nNNbb.."], ["...pPpqq..", "..qp..Pp..", ".bn...nNN."]],
};

const SPR_CACHE = new Map();

function mats(role) {
  const c = CREW[role];
  return { ...c, eye: ["#1a1020"], blush: [mixHex(c.skin[2], "#e0605a", 0.4)] };
}

/**
 * Build (and cache) one character frame as a 16x20 Buf.
 * dir: down|up|left|right. pose: stand|walk|seat|hold|carry|up. frame 0-3 (walk cycle). mouth: bool.
 */
export function characterSprite(role, dir, pose = "stand", frame = 0, mouth = false) {
  const key = `${role}|${dir}|${pose}|${frame}|${mouth}`;
  let spr = SPR_CACHE.get(key);
  if (spr) return spr;
  const view = dir === "left" || dir === "right" ? "side" : dir;
  const g = Array.from({ length: 20 }, () => Array(16).fill("."));
  const stamp = (rows, ox, oy) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== "." && g[oy + j] && g[oy + j][ox + i] !== undefined) g[oy + j][ox + i] = ch;
  }));
  const torso = view === "down" ? TORSO.down[role] : TORSO[view][role] || TORSO[view].default;
  const walking = pose === "walk" || pose === "carry";
  const legs = LEGS[view][walking ? frame & 3 : 0];
  stamp(torso, 3, 11);
  stamp(legs, 3, 15);
  // arms
  const sleeveL = view === "side" ? "t" : g[11][4], sleeveR = g[11][11];
  if (view !== "side" && (pose === "seat" || pose === "hold" || pose === "carry")) {
    g[13][4] = sleeveL; g[13][11] = sleeveR; // hands go forward (drawn with the prop)
  }
  if (view !== "side" && pose === "walk") {
    // arm swing: one hand a pixel lower on each stride
    if (frame === 1) { g[14][4] = g[13][4]; g[13][4] = sleeveL; }
    if (frame === 3) { g[14][11] = g[13][11]; g[13][11] = sleeveR; }
  }
  if (view === "side" && pose === "walk") {
    // the near arm swings forward and back
    const fwd = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    if (fwd) { g[13][7] = "u"; g[13][8] = "u"; g[13][6 + fwd] = "k"; g[13][7 + fwd] = "K"; }
  }
  if (view === "side" && (pose === "hold" || pose === "seat" || pose === "carry")) {
    g[12][8] = "t"; g[12][9] = "k"; g[13][7] = "u"; g[13][8] = "u";
  }
  if (pose === "up") {
    if (view === "side") { g[11][8] = "t"; g[10][9] = "t"; g[9][9] = "t"; g[8][9] = "k"; g[12][7] = "u"; g[13][7] = "u"; g[13][8] = "u"; }
    else {
      for (const [c, s] of [[4, "t"], [11, "u"]]) { g[12][c] = "."; g[13][c] = "."; g[11][c] = s; }
      for (const [c, o, s] of [[3, -1, "t"], [12, 1, "u"]]) { g[10][c] = s; g[9][c] = s; g[8][c + o] = s; g[7][c + o] = "k"; g[6][c + o] = "K"; }
    }
  }
  const head = HEADS[role][view];
  stamp(head, 3, 2);
  if (mouth && view === "down") g[10][7] = "m";
  if (mouth && view === "side") g[10][10] = "m";
  if (dir === "left") for (const row of g) row.reverse();

  // colourise + rim light (top/left edge pixels one ramp step lighter)
  const M = mats(role), b = new Buf(16, 20);
  const filled = (x, y) => y >= 0 && y < 20 && x >= 0 && x < 16 && g[y][x] !== ".";
  for (let y = 0; y < 20; y++) for (let x = 0; x < 16; x++) {
    const ch = g[y][x];
    if (ch === ".") continue;
    const [mat, tone] = CODES[ch] || ["top", 2];
    const ramp = M[mat];
    let t = Math.min(tone, ramp.length - 1);
    if (!NO_RIM.has(ch) && (!filled(x - 1, y) || !filled(x, y - 1)) && mat !== "eye") t = Math.min(ramp.length - 1, t + 1);
    b.set(x, y, ramp[t]);
  }
  selout(b);
  spr = { buf: b, ox: 8, oy: 18 };
  SPR_CACHE.set(key, spr);
  return spr;
}

/** Soft oval contact shadow under a character's feet (light from the top left -> nudged right). */
export function footShadow(b, fx, fy, w = 5) {
  for (let dx = -w; dx <= w + 1; dx++) {
    const edge = Math.abs(dx - 0.5) > w - 1.5;
    b.tint(fx + dx, fy, 0.38);
    if (!edge) { b.tint(fx + dx, fy + 1, 0.3); b.tint(fx + dx, fy - 1, 0.18); }
  }
}

export function drawCharacter(b, role, fx, fy, dir, pose, frame, mouth) {
  const s = characterSprite(role, dir, pose, frame, mouth);
  b.blit(s.buf, Math.round(fx) - s.ox, Math.round(fy) - s.oy);
}

// ---------------------------------------------------------------------------
// small held items & effects (drawn after the character)
// ---------------------------------------------------------------------------
function sheet(b, x, y, w, h, ramp, lines, lineCol) {
  b.rect(x, y, w, h, ramp[2]);
  b.hline(x, x + w - 1, y, ramp[3]);
  b.vline(x, y, y + h - 1, ramp[3]);
  for (let i = 0; i < lines; i++) b.hline(x + 1, x + w - 2 - (i % 2), y + 1 + i * 2, lineCol);
  selout_rect(b, x, y, w, h, ramp[0]);
}
function selout_rect(b, x, y, w, h, col) {
  b.hline(x, x + w - 1, y - 1, col); b.hline(x, x + w - 1, y + h, col);
  b.vline(x - 1, y, y + h - 1, col); b.vline(x + w, y, y + h - 1, col);
}

/** A paper (or the red FIX note) held in front of the body. */
export function heldPaper(b, role, fx, fy, dir, red = false) {
  const ramp = red ? ["#5a1018", "#e8908a", "#f6c8c0", "#fff0ea"] : MAP.paper;
  const line = red ? "#c8323a" : "#8a93a8";
  const skin = CREW[role].skin;
  if (dir === "up") return;
  if (dir === "down") {
    sheet(b, fx - 3, fy - 9, 6, 5, ramp, 2, line);
    b.set(fx - 4, fy - 5, skin[2]); b.set(fx + 3, fy - 5, skin[1]);
    b.set(fx - 4, fy - 4, MAP.outline); b.set(fx + 3, fy - 4, MAP.outline);
  } else {
    const s = dir === "right" ? 1 : -1, x = dir === "right" ? fx + 2 : fx - 6;
    sheet(b, x, fy - 10, 5, 5, ramp, 2, line);
    b.set(fx + s * 2, fy - 6, skin[2]);
  }
}

/** Coffee mug in the right hand; `sip` lifts it to the mouth. */
export function heldMug(b, role, fx, fy, dir, sip) {
  const skin = CREW[role].skin, mug = ["#3a2a2a", "#c8c0b4", "#f2ece0", "#ffffff"];
  let x, y;
  if (dir === "down") { x = sip ? fx : fx + 3; y = sip ? fy - 10 : fy - 6; }
  else if (dir === "right") { x = fx + 3; y = sip ? fy - 10 : fy - 6; }
  else if (dir === "left") { x = fx - 6; y = sip ? fy - 10 : fy - 6; }
  else return;
  b.rect(x, y, 3, 3, mug[2]); b.set(x, y, mug[3]); b.hline(x, x + 2, y + 2, mug[1]);
  b.set(x + 1, y, "#5a3420"); // coffee
  b.set(x + 3, y + 1, mug[1]);
  selout_rect(b, x, y, 3, 3, mug[0]);
  b.set(x + 3, y, mug[0]); b.set(x + 4, y + 1, mug[0]); b.set(x + 3, y + 2, mug[0]);
  b.set(x - 1, y + 2, skin[2]);
}

export function steam(b, x, y, t, n = 3) {
  for (let i = 0; i < n; i++) {
    const p = ((t / 900 + i / n) % 1), yy = y - Math.floor(p * 7), xx = x + Math.round(Math.sin(p * 6 + i) * 1.2);
    if (p < 0.85) b.tint(xx, yy, 0.45 * (1 - p), "#ffffff");
  }
}

/** Magnifying glass: ring + glass + handle. */
export function magnifier(b, x, y) {
  const ring = "#6a4a2a", glass = MAP.glass;
  for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]) b.set(x + dx, y + dy, ring);
  b.set(x + 1, y + 1, glass[3]); b.set(x + 2, y + 1, glass[2]); b.set(x + 1, y + 2, glass[2]); b.set(x + 2, y + 2, glass[1]);
  b.set(x + 4, y + 4, "#3a2414"); b.set(x + 5, y + 5, "#3a2414");
}

/** Red alarm flag on a pole, held up high; `wave` 0..3. */
export function alarmFlag(b, fx, fy, dir, wave) {
  const s = dir === "left" ? -1 : 1, x = fx + s * 6, pole = MAP.wood, red = MAP.red;
  const top = fy - 27;
  for (let y = top; y <= fy - 3; y++) { b.set(x, y, pole[3]); b.set(x + s, y, pole[1]); }
  b.set(x, top - 1, MAP.gold[4]); b.set(x + s, top - 1, MAP.gold[2]);
  const shape = [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 1, 1, 0, 0, -1, -1], [0, 0, 0, 1, 1, 1, 0, 0, -1], [0, -1, -1, 0, 0, 1, 1, 0, 0]][wave & 3];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) {
    const yy = top + 1 + j + shape[i];
    const tone = j === 0 ? 4 : j === 6 ? 1 : (i + wave) % 4 === 0 ? 3 : 2;
    b.set(x + s * (i + 2), yy, red[tone]);
  }
  selout(b, Math.min(x, x + s * 12) - 1, top - 3, 15, 30, red[0]);
  // the hand gripping the pole
  const skin = CREW.reviewer.skin;
  b.set(x - s, fy - 8, skin[2]); b.set(x - s, fy - 7, skin[1]);
}

/** "!" speech bubble above a head. */
export function exclaim(b, x, y) {
  const W = "#fffaf0", O = MAP.outline, Y = "#e0a020";
  b.rect(x - 3, y, 7, 8, W);
  b.hline(x - 2, x + 2, y - 1, O); b.hline(x - 2, x + 2, y + 8, O);
  b.vline(x - 4, y, y + 7, O); b.vline(x + 4, y, y + 7, O);
  b.set(x - 3, y, MAP.outline); b.set(x + 3, y, MAP.outline); b.set(x - 3, y + 7, O); b.set(x + 3, y + 7, O);
  b.set(x - 2, y + 1, W); b.set(x + 2, y + 1, W);
  b.set(x, y + 9, W); b.set(x - 1, y + 9, O); b.set(x + 1, y + 9, O); b.set(x, y + 10, O);
  b.vline(x, y + 1, y + 4, Y); b.set(x, y + 6, Y);
  b.set(x + 1, y + 2, "#a86a10"); b.set(x + 1, y + 3, "#a86a10");
  b.tintRect(x + 2, y + 5, 2, 2, 0.08, "#c8b8a0");
}

/** Crumpled paper ball. */
export function paperBall(b, x, y) {
  b.set(x, y, MAP.paper[3]); b.set(x + 1, y, MAP.paper[2]); b.set(x, y + 1, MAP.paper[2]); b.set(x + 1, y + 1, MAP.paper[1]);
}

// ---------------------------------------------------------------------------
// furniture building blocks
// ---------------------------------------------------------------------------
/**
 * A 3/4-view box: `depth` rows of top surface over `h - depth` rows of front face.
 * Outline from the ramp's darkest colour, rim light along the lit top/left edge.
 */
export function box(b, x, y, w, h, depth, ramp, o = {}) {
  const n = ramp.length, top = ramp[Math.min(n - 1, 3)], rim = ramp[n - 1], front = ramp[2], dark = ramp[1];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let c;
    if (j < depth) c = j === 0 || i === 0 ? rim : top;
    else c = j === h - 1 || i === w - 1 ? dark : i === 0 ? ramp[Math.min(n - 1, 3)] : front;
    b.set(x + i, y + j, c);
  }
  if (depth > 0 && depth < h) b.hline(x, x + w - 1, y + depth, o.lip || ramp[1]);
  if (o.outline !== false) {
    const oc = mixHex(ramp[0], MAP.outline, 0.35);
    b.hline(x, x + w - 1, y - 1, mixHex(ramp[0], ramp[1], 0.4)); b.hline(x, x + w - 1, y + h, oc);
    b.vline(x - 1, y, y + h - 1, mixHex(ramp[0], ramp[1], 0.4)); b.vline(x + w, y, y + h - 1, oc);
  }
}

/** Cast shadow on the floor to the bottom-right (light from the top left). */
export function castShadow(b, x, y, w, h, t = 0.32) {
  b.tintRect(x + 1, y + h + 1, w + 1, 2, t);
  b.tintRect(x + w + 1, y + 3, 2, h - 2, t);
}

/** Wooden desk with a drawer panel; returns the top surface rect. */
export function desk(b, x, y, w, ramp = MAP.wood, drawers = true) {
  const depth = 9, h = 16;
  box(b, x, y, w, h, depth, ramp);
  // grain on the top surface: long thin streaks one ramp step apart
  for (let j = 1; j < depth - 1; j++) for (let i = 2; i < w - 2; i++) {
    const v = noise(i / 9, j * 1.7, 7 + x);
    if (v > 0.72) b.set(x + i, y + j, ramp[4] || ramp[3]);
    else if (v < 0.2) b.set(x + i, y + j, mixHex(ramp[3], ramp[2], 0.5));
  }
  if (drawers) {
    const dx = x + w - 13;
    b.rect(dx, y + depth + 1, 11, 5, ramp[1]);
    b.hline(dx, dx + 10, y + depth + 1, ramp[3]);
    b.hline(dx + 4, dx + 6, y + depth + 3, ramp[4] || ramp[3]);
    b.set(x + 2, y + depth + 2, ramp[3]);
  }
  // knee gap
  b.rect(x + 3, y + h - 3, w - 18, 2, ramp[0]);
  return { x, y, w, depth };
}

/** Office chair seen from the front (the back shows above the seat). */
export function chairFront(b, cx, y, ramp = ["#141826", "#262c42", "#3a4260", "#525c80"]) {
  box(b, cx - 5, y, 10, 8, 2, ramp);
  b.rect(cx - 6, y + 8, 12, 3, ramp[2]); b.hline(cx - 6, cx + 5, y + 8, ramp[3]);
  b.hline(cx - 6, cx + 5, y + 11, ramp[0]);
  b.vline(cx, y + 12, y + 13, MAP.metal[1]);
  b.hline(cx - 4, cx + 4, y + 14, MAP.metal[2]); b.set(cx - 4, y + 15, MAP.metal[0]); b.set(cx + 4, y + 15, MAP.metal[0]);
}

/** Office chair seen from behind (for a person facing up). */
export function chairBack(b, cx, y, ramp = ["#141826", "#262c42", "#3a4260", "#525c80"]) {
  box(b, cx - 5, y, 10, 9, 1, ramp);
  for (let j = 2; j < 8; j += 2) b.hline(cx - 3, cx + 3, y + j, ramp[1]);
  b.vline(cx, y + 10, y + 11, MAP.metal[1]);
  b.hline(cx - 4, cx + 4, y + 12, MAP.metal[2]); b.set(cx - 4, y + 13, MAP.metal[0]); b.set(cx + 4, y + 13, MAP.metal[0]);
}

/** Bookshelf against the back wall, full of books. */
export function bookshelf(b, x, y, w, h, seed = 1) {
  const wood = MAP.wood;
  box(b, x, y, w, h, 3, wood);
  const shelves = Math.floor((h - 6) / 7);
  for (let s = 0; s < shelves; s++) {
    const sy = y + 4 + s * 7;
    b.rect(x + 2, sy, w - 4, 6, wood[0]);
    b.hline(x + 2, x + w - 3, sy + 6, wood[3]);
    let bx = x + 2;
    while (bx < x + w - 3) {
      const r = hash(bx, sy, seed), bw = r < 0.2 ? 1 : 2, bh = 4 + Math.floor(hash(bx, sy, seed + 1) * 2.2);
      if (r > 0.9) { bx += 2; continue; } // gap
      const col = MAP.books[Math.floor(hash(bx, sy, seed + 2) * MAP.books.length)];
      for (let i = 0; i < bw && bx + i < x + w - 2; i++) {
        for (let j = 0; j < bh; j++) b.set(bx + i, sy + 6 - bh + j, i === 0 ? mixHex(col, "#fff4d8", 0.25) : col);
        b.set(bx + i, sy + 6 - bh, mixHex(col, "#fff4d8", 0.45));
        b.set(bx + i, sy + 4, mixHex(col, "#1a1030", 0.35));
      }
      bx += bw + (hash(bx, sy, seed + 3) < 0.25 ? 1 : 0);
    }
  }
}

/** Potted plant; `kind` 0 = bushy, 1 = tall snake plant. */
export function plant(b, cx, baseY, kind = 0, seed = 3) {
  const pot = MAP.pot, leaf = MAP.leaf;
  b.tintRect(cx - 3, baseY + 1, 9, 2, 0.32);
  // pot: tapered, rim lit
  for (let j = 0; j < 7; j++) {
    const half = 4 - (j > 3 ? 1 : 0);
    for (let i = -half; i < half; i++) b.set(cx + i, baseY - 6 + j, i === -half ? pot[3] : i >= half - 2 ? pot[1] : pot[2]);
  }
  b.hline(cx - 5, cx + 4, baseY - 7, pot[3]); b.hline(cx - 5, cx + 4, baseY - 6, pot[2]);
  b.set(cx + 4, baseY - 6, pot[1]);
  selout(b, cx - 7, baseY - 9, 14, 11, pot[0]);
  b.hline(cx - 4, cx + 3, baseY - 7, "#3a2216");
  if (kind === 1) {
    const blades = [[-3, 10, -1], [-1, 14, 0], [1, 12, 0], [3, 9, 1], [0, 8, 0]];
    for (const [dx, len, lean] of blades) {
      for (let j = 0; j < len; j++) {
        const xx = cx + dx + Math.round((lean * j) / 6), yy = baseY - 8 - j;
        b.set(xx, yy, j > len - 3 ? leaf[3] : leaf[2]);
        b.set(xx + 1, yy, j % 3 === 0 ? leaf[4] : leaf[1]);
      }
    }
    selout(b, cx - 8, baseY - 26, 18, 20, leaf[0]);
    return;
  }
  // bushy: overlapping leaf blobs, each lit from the top left
  const blobs = [[-4, -11, 4], [3, -12, 4], [0, -16, 4], [-5, -17, 3], [5, -18, 3], [0, -21, 3]];
  for (const [dx, dy, r] of blobs) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + 1) continue;
      const lit = (-i - j) / (2 * r);
      const t = band(0.45 + lit * 0.55, 4, cx + dx + i, baseY + dy + j, 0.35);
      b.set(cx + dx + i, baseY + dy + j, leaf[t + 1]);
    }
    // midrib hint
    b.set(cx + dx, baseY + dy, leaf[1]); b.set(cx + dx + 1, baseY + dy + 1, leaf[1]);
  }
  selout(b, cx - 11, baseY - 27, 23, 20, leaf[0]);
}

/** Window in a wall face: frame, sky glass in bands, diagonal glint, sill. */
export function windowPane(b, x, y, w, h) {
  const wood = MAP.woodPale, sky = MAP.sky;
  b.rect(x, y, w, h, wood[2]);
  for (let j = 1; j < h - 2; j++) for (let i = 1; i < w - 1; i++) {
    const t = band(1 - j / (h - 3), 3, x + i, y + j, 0.4);
    b.set(x + i, y + j, sky[t]);
  }
  // clouds & glints
  b.hline(x + 3, x + 6, y + 3, "#e8f4fa"); b.hline(x + 2, x + 7, y + 4, "#d0e6f2");
  for (let i = 0; i < 4; i++) { b.set(x + w - 6 + i, y + 2 + i, "#d8eef8"); b.set(x + w - 9 + i, y + 2 + i, "#bcdcee"); }
  b.vline(x + (w >> 1), y + 1, y + h - 3, wood[2]);
  b.hline(x + 1, x + w - 2, y + (h >> 1) - 1, wood[2]);
  b.hline(x, x + w - 1, y, wood[3]); b.vline(x, y, y + h - 1, wood[3]);
  b.hline(x - 1, x + w, y + h - 2, wood[3]); b.hline(x - 1, x + w, y + h - 1, wood[1]);
  selout(b, x - 2, y - 1, w + 4, h + 2, wood[0]);
}

/** Rug with a border. */
export function rug(b, x, y, w, h, ramp, accent) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
    const border = i === 2 || j === 2 || i === w - 3 || j === h - 3;
    let c = edge ? ramp[0] : border ? accent : ramp[2];
    if (!edge && !border && i > 3 && j > 3 && i < w - 4 && j < h - 4 && (i + j * 2) % 8 === 0 && (j % 4 === 2)) c = ramp[3];
    if (!edge && !border && (i === 1 || j === 1)) c = ramp[3];
    b.set(x + i, y + j, c);
  }
  // fringe
  for (let j = 1; j < h - 1; j += 2) { b.set(x - 1, y + j, accent); b.set(x + w, y + j, mixHex(accent, MAP.shadow, 0.3)); }
}

/** A potted mini cactus / small props on surfaces. */
export function mug(b, x, y, col = "#e8e2d4") {
  b.rect(x, y, 3, 3, col); b.set(x, y, "#ffffff"); b.set(x + 1, y, "#4a2a18"); b.hline(x, x + 2, y + 2, mixHex(col, "#3a2a2a", 0.3));
  b.set(x + 3, y + 1, mixHex(col, "#3a2a2a", 0.3));
  selout(b, x - 1, y - 1, 6, 5, "#2a2026");
}

/** Wall clock. */
export function clock(b, cx, cy) {
  const r = 3;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) b.set(cx + i, cy + j, i + j < -2 ? "#ffffff" : "#ece6d8");
  selout(b, cx - r - 1, cy - r - 1, 2 * r + 3, 2 * r + 3, "#3a2a2a");
  b.vline(cx, cy - 2, cy, "#2a2026"); b.hline(cx, cx + 1, cy, "#2a2026");
}

/** Framed picture on a wall. */
export function picture(b, x, y, w, h, kind = "hills") {
  const fr = MAP.gold;
  b.rect(x, y, w, h, fr[2]); b.hline(x, x + w - 1, y, fr[3]); b.vline(x, y, y + h - 1, fr[3]);
  b.hline(x, x + w - 1, y + h - 1, fr[1]); b.vline(x + w - 1, y, y + h - 1, fr[1]);
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
    let c;
    if (kind === "hills") {
      const hill = ih * 0.55 + Math.sin(i * 0.45) * 1.5;
      c = j < hill ? (j < ih * 0.3 ? "#8cc4e8" : "#b4dcf0") : j < hill + 2 ? "#6aa84a" : "#3f7a3c";
    } else c = "#d8c8a8";
    b.set(ix + i, iy + j, c);
  }
  if (kind === "hills") { b.set(ix + iw - 3, iy + 1, "#fff0a0"); b.set(ix + iw - 2, iy + 1, "#fff8c8"); }
  selout(b, x - 1, y - 1, w + 2, h + 2, fr[0]);
}

// ---------------------------------------------------------------------------
// room props
// ---------------------------------------------------------------------------
/** Laptop seen from behind (lid back + base edge). */
export function laptopBack(b, x, y) {
  const m = MAP.metal;
  b.rect(x, y, 11, 6, m[3]); b.hline(x, x + 10, y, m[4]); b.vline(x, y, y + 5, m[4]);
  b.vline(x + 10, y + 1, y + 5, m[2]); b.hline(x, x + 10, y + 6, m[1]);
  b.set(x + 5, y + 2, "#f2f6fa"); b.set(x + 5, y + 3, m[4]);
  selout(b, x - 1, y - 1, 13, 9, m[0]);
}

/** Monitor facing the viewer; returns the screen rect for animation. */
export function monitor(b, x, y, w = 15, h = 10) {
  const m = MAP.metal, s = MAP.screen;
  b.rect(x, y, w, h, m[1]); b.hline(x, x + w - 1, y, m[2]);
  b.rect(x + 1, y + 1, w - 2, h - 3, s[1]);
  b.hline(x + 1, x + w - 2, y + h - 2, m[1]);
  b.set(x + (w >> 1), y + h - 2, "#7cffa0");
  b.rect(x + (w >> 1) - 1, y + h, 3, 2, m[2]); b.hline(x + (w >> 1) - 3, x + (w >> 1) + 3, y + h + 2, m[3]);
  selout(b, x - 1, y - 1, w + 2, h + 5, m[0]);
  return { x: x + 1, y: y + 1, w: w - 2, h: h - 3 };
}

/** Typewriter on a desk. */
export function typewriter(b, x, y) {
  const g = ["#14241e", "#24443a", "#36624f", "#4f8468"];
  b.rect(x + 1, y, 12, 3, g[3]); b.hline(x + 1, x + 12, y, "#78b090");
  b.rect(x, y + 3, 14, 5, g[2]); b.hline(x, x + 13, y + 7, g[1]);
  for (let i = 0; i < 5; i++) { b.set(x + 2 + i * 2, y + 4, "#e8e2d0"); b.set(x + 3 + i * 2, y + 5, "#e8e2d0"); }
  b.rect(x + 3, y - 4, 8, 4, MAP.paper[3]); b.hline(x + 4, x + 9, y - 3, "#8a93a8"); b.hline(x + 4, x + 7, y - 2, "#8a93a8");
  b.vline(x - 1, y + 1, y + 2, MAP.metal[4]);
  selout(b, x - 2, y - 5, 18, 14, g[0]);
}

/** Paper stack. */
export function papers(b, x, y, n = 3) {
  for (let i = 0; i < n; i++) b.rect(x + (i % 2), y - i, 7, 4, MAP.paper[i === n - 1 ? 3 : 2]);
  b.hline(x + 1, x + 5, y - n + 2, "#8a93a8");
  selout(b, x - 1, y - n - 1, 10, n + 7, MAP.paper[0]);
}

/** Waste bin with crumpled paper. */
export function bin(b, x, y) {
  const m = ["#1c2230", "#2e3a4e", "#465670", "#62769a"];
  for (let j = 0; j < 8; j++) for (let i = 0; i < 7; i++) b.set(x + i, y + j, j === 0 ? m[3] : i === 0 ? m[3] : i > 4 ? m[1] : m[2]);
  b.hline(x + 1, x + 5, y + 1, m[0]);
  b.set(x + 2, y, MAP.paper[3]); b.set(x + 3, y - 1, MAP.paper[2]); b.set(x + 4, y, MAP.paper[2]);
  selout(b, x - 1, y - 2, 9, 11, m[0]);
}

/** Cork board with pinned notes. */
export function corkboard(b, x, y, w, h) {
  const c = ["#5a3a1e", "#8a5e32", "#b07e48", "#c89a60"];
  b.rect(x, y, w, h, c[2]);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) if (hash(i, j, 5) > 0.82) b.set(x + i, y + j, c[3]);
  const notes = ["#f6e27a", "#9fd8f0", "#f6a8b8", "#b8eaa0", "#fffaee"];
  for (let k = 0; k < 6; k++) {
    const nx = x + 2 + ((k * 7) % (w - 6)), ny = y + 1 + ((k * 3) % (h - 5)), col = notes[k % notes.length];
    b.rect(nx, ny, 4, 4, col); b.hline(nx + 1, nx + 2, ny + 2, mixHex(col, "#3a3040", 0.45));
    b.set(nx + 1, ny, "#d83a3a");
  }
  b.hline(x, x + w - 1, y, c[3]); b.vline(x, y, y + h - 1, c[3]);
  selout(b, x - 1, y - 1, w + 2, h + 2, c[0]);
  b.hline(x, x + w - 1, y + h - 1, c[1]); b.vline(x + w - 1, y, y + h - 1, c[1]);
}

/** Acoustic foam: egg-crate squares across a wall face. */
export function foamWall(b, x, y, w, h) {
  const f = MAP.wallBooth;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = i % 6, cy = j % 6;
    const flip = (Math.floor(i / 6) + Math.floor(j / 6)) % 2;
    let t = 2;
    if (cx === 0 || cy === 0) t = 0;
    else if ((flip ? cy : cx) <= 2) t = 3;
    else t = 1;
    b.set(x + i, y + j, f[t]);
  }
}

/** ON AIR sign; lit when recording. */
export function onAir(b, x, y, lit) {
  const red = MAP.red;
  b.rect(x, y, 27, 9, lit ? red[2] : "#3a1a22");
  b.hline(x, x + 26, y, lit ? red[3] : "#4e2630");
  pixText(b, x + 2, y + 2, "ON AIR", lit ? "#fff4e0" : "#6a3a40");
  selout(b, x - 1, y - 1, 29, 11, MAP.outline);
}

/** Speaker cabinet. */
export function speaker(b, x, y) {
  const m = ["#0e0f16", "#1c1e2a", "#2c3040", "#40465c"];
  box(b, x, y, 9, 15, 2, m);
  for (const [cy, r] of [[6, 2], [11, 1]]) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) b.set(x + 4 + i, y + cy + j, i + j < 0 ? "#5a6078" : "#0a0a10");
  }
  b.set(x + 4, y + 6, "#8890a8");
}

/** Mixing console (on a desk), meters animated by `level` 0..1 per channel. */
export function consoleDesk(b, x, y, levels) {
  const m = MAP.metal;
  b.rect(x, y, 14, 6, m[1]); b.hline(x, x + 13, y, m[3]);
  for (let i = 0; i < 6; i++) {
    const cx = x + 1 + i * 2, lv = levels ? levels[i] : 0;
    b.vline(cx, y + 2, y + 5, "#14161e");
    b.set(cx, y + 5 - Math.round(lv * 3), lv > 0.8 ? "#ff6a4a" : "#7cffa0");
    b.set(cx + 1, y + 2 + (i * 7) % 3, m[4]);
  }
  selout(b, x - 1, y - 1, 16, 8, m[0]);
}

/** Studio microphone on a boom arm, with a pop filter. */
export function micBoom(b, x, y) {
  const m = MAP.metal;
  for (let i = 0; i < 7; i++) b.set(x + 6 - i, y + 8 - Math.round(i * 0.6), m[2]);
  b.vline(x + 6, y + 8, y + 12, m[1]);
  b.rect(x - 1, y, 3, 6, m[3]); b.vline(x - 1, y, y + 5, m[4]); b.vline(x + 1, y, y + 5, m[2]);
  b.hline(x - 1, x + 1, y + 2, m[1]); b.hline(x - 1, x + 1, y + 4, m[1]);
  selout(b, x - 3, y - 1, 11, 14, m[0]);
  // pop filter: dark mesh ring in front (towards the viewer, left of the mic)
  for (const [i, j] of [[-4, 1], [-5, 2], [-5, 3], [-4, 4], [-3, 2], [-3, 3]]) b.set(x + i, y + j, "#2a2c3a");
  b.set(x - 4, y + 2, "#4a4e64"); b.set(x - 4, y + 3, "#3a3e52");
}

/** Kitchen counter (cabinet base + worktop) along the back wall. */
export function counter(b, x, y, w) {
  const top = ["#5a5e66", "#8a9098", "#c4c8cc", "#e2e4e4", "#f6f6f2"], cab = MAP.woodPale;
  box(b, x, y + 6, w, 12, 0, cab);
  for (let i = 0; i < w - 2; i += 12) {
    b.rect(x + i + 1, y + 8, 10, 8, cab[2]); b.hline(x + i + 1, x + i + 10, y + 8, cab[3]);
    b.vline(x + i + 10, y + 8, y + 15, cab[1]); b.hline(x + i + 4, x + i + 7, y + 10, cab[1]);
  }
  box(b, x - 1, y, w + 2, 6, 5, top);
}

export function sink(b, x, y) {
  const m = MAP.metal;
  b.rect(x, y, 10, 4, m[2]); b.rect(x + 1, y + 1, 8, 3, m[1]); b.hline(x + 1, x + 8, y + 3, m[0]);
  b.set(x + 4, y + 2, m[0]);
  b.vline(x + 4, y - 3, y - 1, m[3]); b.hline(x + 4, x + 6, y - 3, m[3]); b.set(x + 6, y - 2, m[2]);
}

export function coffeeMachine(b, x, y, on) {
  const k = ["#14141c", "#262836", "#3a3e52", "#585e78"];
  box(b, x, y, 10, 13, 2, k);
  b.rect(x + 2, y + 4, 6, 4, "#0c0c12");
  b.set(x + 7, y + 3, on ? "#ff5a3a" : "#5a2a2a");
  b.set(x + 2, y + 3, "#7cffa0");
  b.rect(x + 3, y + 8, 3, 2, "#f2ece0"); b.set(x + 4, y + 8, "#4a2a18");
  b.rect(x + 1, y + 10, 8, 1, k[3]);
}

export function fridge(b, x, y, w, h) {
  const f = ["#6a7484", "#a6b0bc", "#d2d8de", "#eef0f0", "#ffffff"];
  box(b, x, y, w, h, 3, f);
  b.hline(x + 1, x + w - 2, y + 11, f[1]);
  b.vline(x + 2, y + 6, y + 9, f[0]); b.vline(x + 2, y + 14, y + 19, f[0]);
  b.rect(x + w - 6, y + 14, 3, 3, "#f6a8b8"); b.rect(x + w - 6, y + 5, 3, 2, "#9fd8f0");
}

export function cabinetsUpper(b, x, y, w) {
  const c = MAP.woodPale;
  box(b, x, y, w, 8, 0, c);
  for (let i = 0; i < w; i += 10) {
    b.vline(x + i + 9, y, y + 7, c[1]); b.set(x + i + 7, y + 4, c[0]); b.set(x + i + 8, y + 4, c[0]);
  }
}

/** Round table seen from above with a soft shadow. */
export function roundTable(b, cx, cy, rx, ry) {
  const w = MAP.woodPale;
  b.tintRect(cx - rx + 2, cy + ry, rx * 2, 3, 0.3);
  b.vline(cx, cy + ry, cy + ry + 4, w[0]); b.hline(cx - 3, cx + 3, cy + ry + 5, w[1]);
  for (let j = -ry; j <= ry + 2; j++) for (let i = -rx; i <= rx; i++) {
    const inTop = (i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1;
    const inEdge = (i * i) / (rx * rx) + ((j - 2) * (j - 2)) / (ry * ry) <= 1;
    if (inTop) {
      const lit = -(i / rx + j / ry);
      b.set(cx + i, cy + j, w[2 + band(0.5 + lit * 0.45, 2, cx + i, cy + j, 0.4)]);
    } else if (inEdge) b.set(cx + i, cy + j, w[1]);
  }
  selout(b, cx - rx - 1, cy - ry - 1, rx * 2 + 3, ry * 2 + 9, w[0]);
}

export function stool(b, cx, y) {
  const s = MAP.fabricRose;
  b.rect(cx - 3, y, 7, 3, s[2]); b.hline(cx - 3, cx + 3, y, s[3]); b.hline(cx - 3, cx + 3, y + 3, s[1]);
  b.vline(cx - 2, y + 4, y + 6, MAP.metal[2]); b.vline(cx + 2, y + 4, y + 6, MAP.metal[1]);
  selout(b, cx - 4, y - 1, 9, 9, s[0]);
}

/** Water cooler. */
export function waterCooler(b, x, y) {
  const g = MAP.glass, wcol = MAP.white;
  b.rect(x + 1, y, 6, 6, g[2]); b.vline(x + 1, y, y + 5, g[3]); b.vline(x + 6, y, y + 5, g[1]);
  b.hline(x + 2, x + 5, y + 1, g[3]);
  box(b, x, y + 6, 8, 12, 2, wcol);
  b.set(x + 2, y + 10, "#3a6ad8"); b.set(x + 5, y + 10, "#d83a3a");
  selout(b, x - 1, y - 1, 10, 7, g[0]);
}

/** Easel holding a canvas that faces the viewer; `progress` 0..1 reveals the painting. */
export function easel(b, x, y, progress = 1) {
  const w = MAP.woodPale;
  // legs
  for (let j = 0; j < 24; j++) { b.set(x + 2 + Math.floor(j / 8), y + 2 + j, w[2]); b.set(x + 17 - Math.floor(j / 8), y + 2 + j, w[1]); }
  b.vline(x + 10, y + 16, y + 27, w[1]);
  // canvas
  const cx = x + 1, cy = y, cw = 18, ch = 15;
  b.rect(cx, cy, cw, ch, "#f6f0e2");
  const reveal = Math.floor(progress * cw * ch);
  let k = 0;
  for (let j = 1; j < ch - 1; j++) for (let i = 1; i < cw - 1; i++) {
    k++;
    if (k > reveal) continue;
    const hill = 9 + Math.round(Math.sin(i * 0.5) * 1.2);
    const volcano = Math.abs(i - 9) < (j - 3) * 0.9 && j > 4;
    let c = j < 6 ? "#9cd0ec" : "#c4e4f2";
    if (volcano) c = Math.abs(i - 9) < 1 && j < 7 ? "#ff7a3a" : i < 9 ? "#8a6a5a" : "#6a4e44";
    if (j > hill + 1) c = i % 5 === 0 ? "#5a9a4a" : "#4a8a3e";
    if (j === 3 && Math.abs(i - 9) <= 1) c = "#ffb04a";
    b.set(cx + i, cy + j, c);
  }
  b.hline(cx, cx + cw - 1, cy + ch, w[1]); b.hline(cx - 1, cx + cw, cy + ch + 1, w[2]);
  selout(b, cx - 2, cy - 1, cw + 4, ch + 4, w[0]);
  b.vline(cx, cy, cy + ch - 1, "#fffaf2");
}

/** Small paint cart with jars and a palette. */
export function taboret(b, x, y) {
  box(b, x, y, 13, 11, 4, ["#2a2a34", "#44465a", "#62667e", "#8a8ea6"]);
  const jars = ["#e8584f", "#f0c43a", "#3fa488", "#4f80d6"];
  jars.forEach((c, i) => { b.rect(x + 1 + i * 3, y - 2, 2, 3, c); b.set(x + 1 + i * 3, y - 2, mixHex(c, "#ffffff", 0.4)); });
  b.hline(x + 2, x + 10, y + 7, "#2a2a34");
}

/** Storyboard strip on the wall: small framed panels. */
export function storyboard(b, x, y, n = 5) {
  const scenes = [["#9cd0ec", "#4a8a3e"], ["#2a2440", "#ff7a3a"], ["#c4e4f2", "#8a6a5a"], ["#f6e27a", "#e8584f"], ["#3a5a9c", "#9fd8f0"]];
  for (let k = 0; k < n; k++) {
    const px = x + k * 11, [a, c] = scenes[k % scenes.length];
    b.rect(px, y, 9, 7, "#fffaf0");
    b.rect(px + 1, y + 1, 7, 3, a); b.rect(px + 1, y + 4, 7, 2, c);
    b.set(px + 3 + (k % 3), y + 3, "#fffaf0");
    selout(b, px - 1, y - 1, 11, 9, "#2a2026");
    b.set(px + 4, y - 1, "#d83a3a");
  }
}

/** Wall shelf with paint pots. */
export function paintShelf(b, x, y, w) {
  const wd = MAP.woodPale, pots = ["#e8584f", "#f0c43a", "#3fa488", "#4f80d6", "#a77fd0", "#ff9a4a"];
  for (let i = 0; i < Math.floor((w - 2) / 4); i++) {
    const c = pots[i % pots.length];
    b.rect(x + 1 + i * 4, y - 4, 3, 4, c); b.set(x + 1 + i * 4, y - 4, mixHex(c, "#ffffff", 0.45));
    b.set(x + 3 + i * 4, y - 1, mixHex(c, "#1a1030", 0.35));
  }
  b.hline(x, x + w - 1, y, wd[3]); b.hline(x, x + w - 1, y + 1, wd[1]);
  selout(b, x - 1, y - 5, w + 2, 8, wd[0]);
}

/** Armchair facing sideways (dir 1 = faces right). */
export function armchair(b, x, y, dir, ramp = MAP.fabricRose) {
  box(b, x, y, 12, 14, 3, ramp);
  const backX = dir > 0 ? x : x + 9;
  b.rect(backX, y - 3, 3, 15, ramp[3]); b.vline(backX + (dir > 0 ? 2 : 0), y - 3, y + 11, ramp[1]);
  b.rect(x + (dir > 0 ? 3 : 0), y + 3, 9, 6, ramp[2]); b.hline(x + (dir > 0 ? 3 : 0), x + (dir > 0 ? 11 : 8), y + 3, ramp[3]);
  selout(b, x - 1, y - 4, 14, 20, ramp[0]);
}

export function lowTable(b, x, y, w, h) {
  box(b, x, y, w, h, h - 3, MAP.wood);
  for (let i = 3; i < w - 3; i++) if (hash(i, y, 9) > 0.7) b.set(x + i, y + 2, MAP.wood[4]);
}

/** Desk lamp. */
export function lamp(b, x, y, on = true) {
  const m = ["#3a2a1a", "#6a4a2a", "#a8783a", "#d8a84a"];
  b.hline(x - 2, x + 2, y + 6, m[1]); b.vline(x, y + 2, y + 5, m[2]);
  b.rect(x - 2, y, 5, 2, m[3]); b.hline(x - 3, x + 3, y + 2, m[2]);
  if (on) { b.set(x - 1, y + 3, "#fff4b0"); b.set(x + 1, y + 3, "#fff0a0"); }
  selout(b, x - 4, y - 1, 9, 9, m[0]);
}

/** Rubber stamp + ink pad. */
export function stampPad(b, x, y, inkCol = "#c8323a") {
  b.rect(x, y, 5, 3, "#2a2a34"); b.rect(x + 1, y + 1, 3, 1, inkCol);
  b.rect(x + 6, y - 2, 3, 3, "#6a4426"); b.set(x + 7, y - 4, "#9c6c3c"); b.set(x + 7, y - 3, "#6a4426");
  b.hline(x + 6, x + 8, y + 1, inkCol);
}

// ---------------------------------------------------------------------------
// the presenter "STAR" poster (outfit from style.json)
// ---------------------------------------------------------------------------
export function starPoster(b, x, y, outfit = "blazer") {
  const P = PRESENTER, o = P.outfits[outfit] || P.outfits.blazer, gold = MAP.gold;
  const W = 26, H = 34;
  // easel stand behind
  b.vline(x + 4, y + H - 2, y + H + 7, MAP.wood[1]); b.vline(x + W - 5, y + H - 2, y + H + 7, MAP.wood[1]);
  b.vline(x + W / 2, y + H, y + H + 5, MAP.wood[0]);
  b.tintRect(x + 3, y + H + 7, W - 3, 2, 0.3);
  // frame
  b.rect(x, y, W, H, gold[2]);
  b.hline(x, x + W - 1, y, gold[4]); b.vline(x, y, y + H - 1, gold[3]);
  b.hline(x, x + W - 1, y + H - 1, gold[1]); b.vline(x + W - 1, y, y + H - 1, gold[1]);
  for (let i = 2; i < W - 2; i += 3) b.set(x + i, y + 1, gold[3]);
  // backdrop: spotlight in bands (dither only at the band edges)
  const ix = x + 2, iy = y + 2, iw = W - 4, ih = H - 10;
  const bgR = ["#1a1438", "#2a2058", "#3e2e7a", "#5a4498"];
  for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
    const dx = (i - iw / 2) / (iw / 2), dy = (j - ih * 0.4) / ih;
    const v = 1 - Math.sqrt(dx * dx * 0.7 + dy * dy * 1.6);
    b.set(ix + i, iy + j, bgR[band(v, 4, ix + i, iy + j, 0.4)]);
  }
  // shoulders / torso
  const cx = ix + (iw >> 1);
  const jk = o.jacket, sh = o.shirt;
  for (let j = 0; j < 7; j++) for (let i = -9 + Math.max(0, 2 - j); i <= 8 - Math.max(0, 2 - j); i++) {
    const yy = iy + ih - 7 + j, xx = cx + i;
    let c = i < -3 ? jk[3] : i > 3 ? jk[1] : jk[2];
    if (Math.abs(i + 0.5) <= 2.5 - Math.min(j, 2) * 0.0 && j < 6 && Math.abs(i + 0.5) < 3 - j * 0.3) c = sh[2];
    if (Math.abs(i + 0.5) < 1 && j < 5) c = j % 2 ? sh[1] : sh[2];
    b.set(xx, yy, c);
  }
  // lapels
  b.set(cx - 3, iy + ih - 7, jk[0]); b.set(cx + 2, iy + ih - 7, jk[0]);
  b.set(cx - 2, iy + ih - 5, jk[0]); b.set(cx + 1, iy + ih - 5, jk[0]);
  b.hline(cx - 9, cx - 4, iy + ih - 7, o.rim);
  // neck
  b.rect(cx - 1, iy + ih - 9, 2, 2, P.skin[1]);
  // head: 10 wide x 11 tall, light from the top left
  const hx = cx - 5, hy = iy + ih - 20;
  const face = [
    "..hhHhHh..", ".hHhHhhhh.", "hhHhhHhhhh", "hhkKKKkkhh", "hkKkkkkkzh",
    "hkGGGGGGkh", "hkGeGGeGkh", ".kEEkkEEk.", ".kkkmmkzz.", "..kkkkzz..", "...zzzz...",
  ];
  const map = { h: P.hair[2], H: P.hair[3], k: P.skin[2], K: P.skin[3], z: P.skin[1], G: P.glasses[1], E: P.glasses[0], e: "#1a1020", m: "#a85a4a" };
  face.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) b.set(hx + i, hy + j, map[ch]); }));
  b.set(hx + 2, hy + 5, P.glasses[2]); // glint on the frame
  // curls: a few lit and shaded hair pixels around the crown
  for (const [i, j, c] of [[1, -1, 2], [3, -1, 3], [5, -1, 2], [7, -1, 2], [0, 1, 3], [9, 2, 1], [8, -1, 1], [-1, 3, 2], [10, 4, 1]]) {
    b.set(hx + i, hy + j, P.hair[c]);
  }
  selout(b, hx - 2, hy - 2, 14, 15, P.hair[0]);
  // plate with STAR + stars
  const py = y + H - 7;
  b.rect(x + 3, py, W - 6, 6, "#1a1030");
  b.hline(x + 3, x + W - 4, py, gold[3]);
  pixText(b, x + 6, py + 1, "STAR", gold[4]);
  // gold star on top of the frame
  const tx = x + W / 2, ty = y - 3;
  for (const [i, j] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, 2], [-1, 2], [1, 2], [2, 2], [-3, 3], [3, 3]]) {
    b.set(tx + i, ty + j, i + j < 0 ? gold[4] : gold[3]);
  }
  selout(b, x - 1, y - 6, W + 2, H + 7, gold[0]);
}

/** Crate of vinyl records. */
export function vinylCrate(b, x, y) {
  box(b, x, y, 12, 9, 2, MAP.woodPale);
  const sl = ["#e8584f", "#1a1a22", "#f0c43a", "#1a1a22", "#4f80d6", "#1a1a22", "#a77fd0"];
  sl.forEach((c, i) => b.vline(x + 2 + i, y - 2 + (i % 2), y + 2, c));
}

/** Acoustic guitar leaning on a stand. */
export function guitar(b, x, y) {
  const w = MAP.wood;
  const body = [[1, 3], [0, 5], [0, 5], [1, 3], [0, 5], [0, 6], [0, 6], [1, 4]];
  body.forEach(([o, n], j) => { for (let i = 0; i < n; i++) b.set(x + o + i, y + j, i === 0 ? w[4] : i >= n - 1 ? w[2] : w[3]); });
  b.set(x + 2, y + 5, w[0]); b.set(x + 3, y + 5, w[0]);
  for (let j = 1; j < 9; j++) b.set(x + 2, y - j, w[1]);
  b.rect(x + 1, y - 11, 3, 2, w[0]);
  selout(b, x - 1, y - 12, 9, 22, w[0]);
}

/** Bean bag: a soft lump lit from the top left, with a lighter seat hollow. */
export function beanBag(b, cx, cy, ramp) {
  b.tintRect(cx - 7, cy + 5, 17, 2, 0.3);
  for (let j = -5; j <= 5; j++) for (let i = -9; i <= 9; i++) {
    const top = j < 0 ? (i * i) / 64 + (j * j) / 36 : (i * i) / 81 + (j * j) / 25;
    if (top > 1) continue;
    const lit = -(i / 9) * 0.45 - (j / 5) * 0.5;
    b.set(cx + i, cy + j, ramp[S_clamp(band(0.45 + lit * 0.5, 4, cx + i, cy + j, 0.3), 0, 3)]);
  }
  b.hline(cx - 3, cx + 2, cy - 1, ramp[1]); b.hline(cx - 2, cx + 1, cy, ramp[1]);
  selout(b, cx - 11, cy - 7, 23, 15, mixHex(ramp[0], MAP.outline, 0.4));
}
const S_clamp = (v, a, c) => Math.max(a, Math.min(c, v));
