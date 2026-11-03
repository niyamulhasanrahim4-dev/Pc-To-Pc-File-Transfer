const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcInput);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Generate pixels (256x256 modern Wi-Fi icon)
  const rawRows = [];
  const cx = width / 2;
  const cy = height / 2;
  const rCorner = width * 0.22;

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter byte: none

    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;

      // Rounded rectangle distance check
      const dx = Math.max(0, Math.abs(x - cx) - (cx - rCorner - 8));
      const dy = Math.max(0, Math.abs(y - cy) - (cy - rCorner - 8));
      const distCorner = Math.sqrt(dx * dx + dy * dy);

      if (distCorner > rCorner) {
        // Outside squircle
        row[idx] = 0;
        row[idx + 1] = 0;
        row[idx + 2] = 0;
        row[idx + 3] = 0;
        continue;
      }

      // Smooth squircle border
      const borderFade = Math.max(0, Math.min(1, (rCorner - distCorner)));
      
      // Background gradient (Dark Blue #0f172a to Indigo #1e1b4b to Cyan #0284c7)
      const gradT = (x + y) / (width + height);
      let r = Math.round(15 * (1 - gradT) + 2 * gradT);
      let g = Math.round(23 * (1 - gradT) + 132 * gradT);
      let b = Math.round(42 * (1 - gradT) + 199 * gradT);
      let a = 255 * borderFade;

      // Draw Wi-Fi Waves
      const centerDist = Math.sqrt((x - cx) ** 2 + (y - (cy + 24)) ** 2);
      const angle = Math.atan2((cy + 24) - y, x - cx); // looking upwards

      if (angle >= 0.2 && angle <= Math.PI - 0.2) {
        // Outer wave (~85px radius)
        const d1 = Math.abs(centerDist - 82);
        if (d1 < 9) {
          const intensity = 1 - (d1 / 9);
          r = Math.round(r * (1 - intensity) + 56 * intensity);
          g = Math.round(g * (1 - intensity) + 189 * intensity);
          b = Math.round(b * (1 - intensity) + 248 * intensity);
        }

        // Middle wave (~56px radius)
        const d2 = Math.abs(centerDist - 54);
        if (d2 < 8) {
          const intensity = 1 - (d2 / 8);
          r = Math.round(r * (1 - intensity) + 16 * intensity);
          g = Math.round(g * (1 - intensity) + 185 * intensity);
          b = Math.round(b * (1 - intensity) + 129 * intensity);
        }

        // Inner wave (~30px radius)
        const d3 = Math.abs(centerDist - 28);
        if (d3 < 7) {
          const intensity = 1 - (d3 / 7);
          r = Math.round(r * (1 - intensity) + 56 * intensity);
          g = Math.round(g * (1 - intensity) + 189 * intensity);
          b = Math.round(b * (1 - intensity) + 248 * intensity);
        }
      }

      // Center transmitter dot
      if (centerDist < 9) {
        const intensity = 1 - (centerDist / 9);
        r = Math.round(r * (1 - intensity) + 255 * intensity);
        g = Math.round(g * (1 - intensity) + 255 * intensity);
        b = Math.round(b * (1 - intensity) + 255 * intensity);
      }

      // Transfer arrow badges at bottom (y around cy + 60 to cy + 85)
      const inArrow1 = Math.abs(y - (cy + 60)) < 3 && x >= cx - 45 && x <= cx + 45;
      const inArrowTip1 = Math.abs((x - (cx + 45)) + Math.abs(y - (cy + 60))) < 7 && x >= cx + 38;
      
      const inArrow2 = Math.abs(y - (cy + 75)) < 3 && x >= cx - 45 && x <= cx + 45;
      const inArrowTip2 = Math.abs(((cx - 45) - x) + Math.abs(y - (cy + 75))) < 7 && x <= cx - 38;

      if (inArrow1 || inArrowTip1) {
        r = 255; g = 255; b = 255;
      } else if (inArrow2 || inArrowTip2) {
        r = 56; g = 189; b = 248;
      }

      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = Math.round(a);
    }

    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createIco(pngBuffer) {
  // Single 256x256 PNG-encoded icon entry
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // 256 width is represented by 0
  entry.writeUInt8(0, 1); // 256 height is represented by 0
  entry.writeUInt8(0, 2); // 0 colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset of image data

  return Buffer.concat([header, entry, pngBuffer]);
}

// Generate
const png256 = createPng(256, 256);
const ico = createIco(png256);

fs.mkdirSync(path.join(__dirname, '../public'), { recursive: true });

fs.writeFileSync(path.join(__dirname, '../public/icon.png'), png256);
fs.writeFileSync(path.join(__dirname, '../public/icon.ico'), ico);

console.log('Icons generated successfully: public/icon.png, public/icon.ico');
