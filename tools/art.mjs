// Placeholder art: simple 16×16 drawings made from each row's `look`, so the
// packs load and every stage can be told apart in game before the real
// textures are drawn. Replacing a PNG by hand is fine: tools/generate.mjs only
// writes a placeholder where no file exists yet (unless run with --art).

import { getPixel, image, setPixel } from "./png.mjs";

/** Deterministic noise so regenerating gives the same pictures. */
function noise(seed) {
  let s = 0;
  for (const c of seed) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 16) / 65536;
  };
}

const shade = ([r, g, b], f) => [r * f, g * f, b * f];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const GREY = (rgb) => {
  const l = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  return mix(rgb, [l, l, l], 0.75).map((v) => v * 0.85);
};

function disc(img, cx, cy, r, colour) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) setPixel(img, cx + x, cy + y, colour);
}

/** A crop at `stage` of `max`: stalks grow taller and denser, the ripe stage shows the produce. */
export function cropStage(look, stage, max, { grey = false, top = false, trellis = false } = {}) {
  const img = image(16, 16);
  const rnd = noise(`${look.leaf}${stage}${top}`);
  const leaf = grey ? GREY(look.leaf) : look.leaf;
  const ripe = grey ? GREY(look.ripe) : look.ripe;
  if (trellis) drawTrellis(img);
  const t = (stage + 1) / (max + 1);
  const height = top ? Math.round(4 + 12 * Math.max(0, (stage - 3) / (max - 3))) : Math.round(3 + 13 * t);
  const stalks = [3, 6, 9, 12].slice(0, Math.max(2, Math.ceil(4 * t)));
  for (const x of stalks) {
    for (let y = 0; y < height; y++) {
      const px = x + Math.round(Math.sin((y + x) / 3));
      setPixel(img, px, 15 - y, shade(leaf, 0.8 + 0.3 * rnd()));
      if (y > 2 && rnd() < 0.35) setPixel(img, px + (rnd() < 0.5 ? -1 : 1), 15 - y, shade(leaf, 1.1));
    }
  }
  if (stage >= max) for (const x of stalks) disc(img, x + 1, 15 - Math.round(height * 0.6), 1, ripe);
  else if (stage >= max - 2) for (const x of stalks.slice(0, 2)) setPixel(img, x + 1, 15 - Math.round(height * 0.6), mix(leaf, ripe, 0.5));
  return img;
}

function drawTrellis(img) {
  const bamboo = [170, 150, 80];
  for (let y = 0; y < 16; y++) for (const x of [1, 14]) setPixel(img, x, y, shade(bamboo, y % 4 === 0 ? 0.7 : 1));
  for (const y of [3, 8, 13]) for (let x = 1; x < 15; x++) setPixel(img, x, y, shade(bamboo, 0.9));
}

export function trellis() {
  const img = image(16, 16);
  drawTrellis(img);
  return img;
}

export function sapling(look, stage, stages) {
  const img = image(16, 16);
  const h = 4 + Math.round((8 * (stage + 1)) / stages);
  for (let y = 0; y < h; y++) setPixel(img, 8, 15 - y, [110, 80, 50]);
  const r = 1 + Math.round((3 * (stage + 1)) / stages);
  disc(img, 8, 15 - h, r, look.leaf);
  disc(img, 7, 15 - h + 1, Math.max(1, r - 1), shade(look.leaf, 1.15));
  return img;
}

export function fruitLeaves(look, stage, grey = false) {
  const img = image(16, 16);
  const rnd = noise(`leaves${look.leaf}`);
  const leaf = grey ? GREY(look.leaf) : look.leaf;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = rnd();
      if (v < 0.12) continue; // a few gaps, drawn with alpha_test
      setPixel(img, x, y, shade(leaf, 0.75 + 0.45 * v));
    }
  const colour = [null, look.blossom, look.green, look.ripe][stage];
  if (colour) {
    const c = grey ? GREY(colour) : colour;
    for (const [x, y] of [[3, 3], [11, 4], [6, 10], [13, 12], [2, 13]]) disc(img, x, y, stage === 1 ? 0 : 1, c);
  }
  return img;
}

export function logSide() {
  const img = image(16, 16);
  const rnd = noise("logside");
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPixel(img, x, y, shade([120, 86, 56], x % 4 === 0 ? 0.75 : 0.9 + 0.2 * rnd()));
  return img;
}

export function logTop() {
  const img = image(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      setPixel(img, x, y, d > 7 ? [110, 78, 50] : shade([196, 160, 110], Math.floor(d) % 2 ? 0.9 : 1));
    }
  return img;
}

/** Item icons by shape. */
export function icon([shapeName, rgb]) {
  const img = image(16, 16);
  const dark = shade(rgb, 0.7);
  const light = mix(rgb, [255, 255, 255], 0.3);
  switch (shapeName) {
    case "seeds":
      for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [8, 12]]) {
        setPixel(img, x, y, rgb);
        setPixel(img, x + 1, y, dark);
      }
      break;
    case "head":
      disc(img, 8, 9, 6, rgb);
      for (let y = 4; y < 15; y++) setPixel(img, 8, y, light);
      for (let x = 3; x < 14; x++) setPixel(img, x, 14, dark);
      break;
    case "stalk":
      for (let y = 1; y < 15; y++) {
        setPixel(img, 7, y, y > 11 ? [236, 236, 220] : rgb);
        setPixel(img, 9, y + (y < 4 ? 1 : 0), y > 11 ? [236, 236, 220] : dark);
      }
      break;
    case "cob":
      for (let y = 2; y < 14; y++) for (let x = 6; x < 11; x++) setPixel(img, x, y, (x + y) % 2 ? rgb : dark);
      for (let y = 8; y < 16; y++) setPixel(img, 4 + (y - 8) / 3, y, [120, 170, 70]), setPixel(img, 12 - (y - 8) / 3, y, [120, 170, 70]);
      break;
    case "long":
      for (let i = 0; i < 11; i++) disc(img, 3 + i, 12 - i, 1, i % 3 ? rgb : dark);
      break;
    case "round":
      disc(img, 8, 9, 5, rgb);
      disc(img, 6, 7, 1, light);
      setPixel(img, 8, 3, [80, 130, 60]);
      setPixel(img, 9, 3, [80, 130, 60]);
      break;
    case "bits":
      for (const [x, y] of [[4, 6], [8, 5], [11, 7], [6, 9], [10, 10], [5, 12], [9, 13]]) disc(img, x, y, 1, (x + y) % 2 ? rgb : light);
      break;
    case "bowl":
      for (let y = 9; y < 14; y++) for (let x = 2 + (y - 9); x < 14 - (y - 9); x++) setPixel(img, x, y, [150, 110, 70]);
      for (let x = 3; x < 13; x++) setPixel(img, x, 8, rgb), setPixel(img, x, 7, x % 3 ? rgb : light);
      break;
    default:
      throw new Error(`art: unknown icon shape ${shapeName}`);
  }
  return img;
}

/** A block's inventory/guidebook icon made from one of its textures. */
export const copy = (img) => {
  const out = image(img.width, img.height);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) setPixel(out, x, y, getPixel(img, x, y));
  return out;
};

export function packIcon() {
  const img = image(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) setPixel(img, x, y, mix([120, 180, 90], [244, 200, 90], y / 64));
  disc(img, 22, 34, 10, [214, 232, 178]);
  disc(img, 42, 36, 9, [244, 150, 40]);
  for (let y = 18; y < 52; y++) setPixel(img, 32, y, [92, 168, 70]), setPixel(img, 33, y, [70, 150, 60]);
  return img;
}
