// Minimal RGBA PNG writer (no dependencies) for the placeholder art.

import { deflateSync, inflateSync } from "node:zlib";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** An image: width × height RGBA pixels, all transparent. */
export function image(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function setPixel(img, x, y, [r, g, b, a = 255]) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data.set([r, g, b, a].map((v) => Math.max(0, Math.min(255, Math.round(v)))), i);
}

export function getPixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [...img.data.slice(i, i + 4)];
}

export function encodePng(img) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(img.width, 0);
  header.writeUInt32BE(img.height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (img.width * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Reads an 8-bit RGBA, non-interlaced PNG (what tools/art writes) into an image. */
export function decodePng(buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || data[12] !== 0) throw new Error("decodePng: only 8-bit non-interlaced PNGs");
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const channels = { 6: 4, 2: 3 }[colorType];
  if (!channels) throw new Error(`decodePng: colour type ${colorType} not supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = image(width, height);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      line[i] = (x + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const px = line.subarray(x * channels, x * channels + channels);
      setPixel(out, x, y, channels === 4 ? [...px] : [...px, 255]);
    }
    prev.set(line);
  }
  return out;
}
