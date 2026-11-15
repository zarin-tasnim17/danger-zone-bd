const fs = require('fs');
const path = require('path');

function renderIconPixels(size) {
  const pixels = [];
  const W = size;
  const H = size;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;

      // Squircle outer boundary (rounded rect with radius 0.22)
      const cornerR = 0.22;
      const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - cornerR));
      const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - cornerR));
      const distSq = dx * dx + dy * dy;

      if (distSq > cornerR * cornerR) {
        // Transparent outside squircle
        pixels.push([0, 0, 0, 0]);
        continue;
      }

      // Default background: deep slate/navy gradient
      let r = Math.round(15 - ny * 10);
      let g = Math.round(23 - ny * 15);
      let b = Math.round(42 - ny * 20);
      let a = 255;

      // Shield outline check
      // Top line: from (0.23, 0.27) -> (0.5, 0.15) -> (0.77, 0.27)
      // Bottom curve to (0.5, 0.86)
      const symX = Math.abs(nx - 0.5); // 0 at center, 0.5 at edges
      const inTopApex = ny >= 0.15 + symX * 0.44;
      const inSideBounds = symX <= 0.28;
      
      // Bottom parabolic curvature
      const curveY = 0.27 + Math.pow(symX / 0.28, 1.8) * 0.59;
      const inBottomBounds = ny <= 0.86 && ny <= curveY + (0.86 - curveY) * (1 - Math.pow(symX / 0.28, 2));

      const inShield = inTopApex && inSideBounds && inBottomBounds;

      if (inShield) {
        // Red gradient
        r = Math.round(244 - ny * 60);
        g = Math.round(63 - ny * 35);
        b = Math.round(94 - ny * 65);

        // Border highlight
        const nearEdge = symX > 0.24 || ny < 0.18 + symX * 0.44 || (0.86 - ny) < 0.05;
        if (nearEdge) {
          r = 253;
          g = 164;
          b = 175;
        }

        // Exclamation Mark inside Shield
        // Vertical stem: nx in [0.46, 0.54], ny in [0.33, 0.55]
        const inStem = Math.abs(nx - 0.5) <= 0.045 && ny >= 0.33 && ny <= 0.55;
        // Dot: center (0.5, 0.67), radius 0.045
        const dotDist = Math.hypot(nx - 0.5, ny - 0.67);
        const inDot = dotDist <= 0.048;

        if (inStem || inDot) {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      pixels.push([r, g, b, a]);
    }
  }

  return pixels;
}

function buildIcoFile(sizes) {
  const images = sizes.map(size => {
    const pixels = renderIconPixels(size);
    const dibHeaderSize = 40;
    const pixelDataSize = size * size * 4;
    const andMaskRowSize = Math.floor((size + 31) / 32) * 4;
    const andMaskSize = andMaskRowSize * size;
    const bytesInRes = dibHeaderSize + pixelDataSize + andMaskSize;

    const dib = Buffer.alloc(dibHeaderSize);
    dib.writeUInt32LE(dibHeaderSize, 0);
    dib.writeInt32LE(size, 4);
    dib.writeInt32LE(size * 2, 8); // Double height for mask
    dib.writeUInt16LE(1, 12);
    dib.writeUInt16LE(32, 14); // 32 bits RGBA
    dib.writeUInt32LE(0, 16);
    dib.writeUInt32LE(pixelDataSize, 20);

    const pixelData = Buffer.alloc(pixelDataSize);
    const andMask = Buffer.alloc(andMaskSize, 0);

    for (let y = 0; y < size; y++) {
      // BMP is stored bottom-to-top
      const srcY = size - 1 - y;
      for (let x = 0; x < size; x++) {
        const idx = srcY * size + x;
        const [r, g, b, a] = pixels[idx];
        const outOffset = (y * size + x) * 4;
        pixelData.writeUInt8(b, outOffset);
        pixelData.writeUInt8(g, outOffset + 1);
        pixelData.writeUInt8(r, outOffset + 2);
        pixelData.writeUInt8(a, outOffset + 3);

        if (a === 0) {
          const maskRowOffset = y * andMaskRowSize;
          const byteIdx = maskRowOffset + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          andMask[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    return {
      size,
      bytesInRes,
      buffer: Buffer.concat([dib, pixelData, andMask]),
    };
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO format
  header.writeUInt16LE(images.length, 4); // Image count

  let currentOffset = 6 + images.length * 16;
  const dirEntries = images.map(img => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.bytesInRes, 8);
    entry.writeUInt32LE(currentOffset, 12);
    currentOffset += img.bytesInRes;
    return entry;
  });

  return Buffer.concat([header, ...dirEntries, ...images.map(img => img.buffer)]);
}

// Generate multi-resolution ICO: 16x16, 32x32, 48x48
const icoBuffer = buildIcoFile([16, 32, 48]);

const paths = [
  path.join(__dirname, '../apps/web/public/favicon.ico'),
  path.join(__dirname, '../apps/web/app/favicon.ico'),
];

for (const p of paths) {
  fs.writeFileSync(p, icoBuffer);
  console.log('Created ICO at', p, '(' + icoBuffer.length + ' bytes)');
}
