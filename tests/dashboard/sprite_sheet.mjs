// Visual QA (not a test): every crew member in every direction and pose at 4x, plus the
// presenter poster in both outfits. Usage: node tests/dashboard/sprite_sheet.mjs <out.png>
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import * as S from "../../tools/dashboard/static/sprites.js";

const ROLES = ["story", "voice", "design", "animator", "reviewer"];
const COLS = [["down", "stand", 0], ["down", "walk", 1], ["down", "walk", 3], ["down", "seat", 0], ["down", "hold", 0],
  ["down", "up", 0], ["up", "stand", 0], ["up", "walk", 1], ["right", "stand", 0], ["right", "walk", 1],
  ["right", "carry", 3], ["left", "stand", 0]];
const b = new S.Buf(COLS.length * 18 + 64, ROLES.length * 26 + 4);
b.rect(0, 0, b.w, b.h, "#82512d");
ROLES.forEach((r, j) => COLS.forEach(([d, p, f], i) => {
  const fx = 9 + i * 18, fy = 22 + j * 26;
  S.footShadow(b, fx, fy);
  S.drawCharacter(b, r, fx, fy, d, p, f, d === "down" && r === "voice" && p === "seat");
  if (p === "hold" || p === "carry") S.heldPaper(b, r, fx, fy, d, r === "reviewer");
  if (r === "reviewer" && p === "stand" && d === "right") S.alarmFlag(b, fx, fy, d, 1);
}));
S.starPoster(b, COLS.length * 18 + 4, 10, "blazer");
S.starPoster(b, COLS.length * 18 + 34, 64, "labcoat");

const SCALE = 4, W = b.w * SCALE, H = b.h * SCALE, raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const v = b.d[Math.floor(y / SCALE) * b.w + Math.floor(x / SCALE)], o = y * (W * 4 + 1) + 1 + x * 4;
  raw[o] = v & 255; raw[o + 1] = (v >> 8) & 255; raw[o + 2] = (v >> 16) & 255; raw[o + 3] = 255;
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(process.argv[2] || "sprites-4x.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
