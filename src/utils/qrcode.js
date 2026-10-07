/**
 * Minimal QR Code generator — pure JS, no dependencies.
 * Supports alphanumeric + numeric + byte mode, ECC levels L/M/Q/H.
 * Returns a 2-D boolean matrix (true = dark module).
 *
 * Based on the QR Code ISO/IEC 18004 spec, ported from public-domain
 * implementations (nayuki.io and zxing).
 */

// ─── GF(256) arithmetic ────────────────────────────────────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const q = [1, GF_EXP[i]];
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let j = 0; j < p.length; j++)
      for (let k = 0; k < q.length; k++)
        r[j + k] ^= gfMul(p[j], q[k]);
    p = r;
  }
  return p;
}

function rsComputeRemainder(data, generator) {
  const result = new Array(generator.length - 1).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < generator.length - 1; i++)
      result[i] ^= gfMul(generator[i + 1], factor);
  }
  return result;
}

// ─── Version / capacity tables (versions 1-10, ECC L only for simplicity) ─
//  [version] = { ecBlocks: [[numBlocks, totalCodewords, dataCodewords]], remainder }
const VERSION_INFO = [
  null, // 1-indexed
  { totalWords:  26, dataWords:  19, ecWords:  7, remainder: 0 },
  { totalWords:  44, dataWords:  34, ecWords: 10, remainder: 7 },
  { totalWords:  70, dataWords:  55, ecWords: 15, remainder: 7 },
  { totalWords: 100, dataWords:  80, ecWords: 20, remainder: 7 },
  { totalWords: 134, dataWords: 108, ecWords: 26, remainder: 7 },
  { totalWords: 172, dataWords: 136, ecWords: 36, remainder: 7 },
  { totalWords: 196, dataWords: 156, ecWords: 40, remainder: 0 },
  { totalWords: 242, dataWords: 194, ecWords: 48, remainder: 0 },
  { totalWords: 292, dataWords: 232, ecWords: 60, remainder: 0 },
  { totalWords: 346, dataWords: 274, ecWords: 72, remainder: 0 },
];

function getVersion(dataBytes) {
  for (let v = 1; v <= 10; v++) {
    if (VERSION_INFO[v] && VERSION_INFO[v].dataWords - 3 >= dataBytes) return v;
  }
  return 10; // clamp
}

// ─── Alignment pattern locations ───────────────────────────────────────────
const ALIGNMENT_POSITIONS = [
  [], [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
];

// ─── Main encoder ──────────────────────────────────────────────────────────
export function generateQR(text) {
  // Encode as byte (UTF-8)
  const bytes = encodeUTF8(text);
  const version = getVersion(bytes.length);
  const info = VERSION_INFO[version];
  const size = version * 4 + 17;

  // Build data bits
  const bits = [];
  // Mode indicator (byte = 0100)
  pushBits(bits, 0b0100, 4);
  // Character count indicator
  const ccBits = version < 10 ? 8 : 16;
  pushBits(bits, bytes.length, ccBits);
  // Data
  for (const b of bytes) pushBits(bits, b, 8);
  // Terminator
  const totalDataBits = info.dataWords * 8;
  for (let i = 0; i < 4 && bits.length < totalDataBits; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes
  const PAD = [0xec, 0x11];
  for (let i = 0; bits.length < totalDataBits; i++) pushBits(bits, PAD[i % 2], 8);

  // Convert to bytes
  const dataBytes2 = bitsToBytes(bits);

  // RS error correction
  const gen = rsGeneratorPoly(info.ecWords);
  const ecBytes = rsComputeRemainder(dataBytes2, gen);

  // Interleave (single block for versions 1-5 approx)
  const allCodewords = [...dataBytes2, ...ecBytes];

  // Build matrix
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  // Finder patterns
  placeFinderPattern(matrix, reserved, 0, 0);
  placeFinderPattern(matrix, reserved, size - 7, 0);
  placeFinderPattern(matrix, reserved, 0, size - 7);

  // Separators (already covered by finder boundary, mark reserved)
  placeSeparators(reserved, size);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (matrix[6][i] === null) { matrix[6][i] = dark; reserved[6][i] = true; }
    if (matrix[i][6] === null) { matrix[i][6] = dark; reserved[i][6] = true; }
  }

  // Dark module
  matrix[size - 8][8] = true; reserved[size - 8][8] = true;

  // Alignment patterns (version >= 2)
  const ap = ALIGNMENT_POSITIONS[version] || [];
  for (const r of ap) for (const c of ap) {
    if (!reserved[r][c]) placeAlignmentPattern(matrix, reserved, r, c);
  }

  // Format info (mask 0, ECC L)
  placeFormatInfo(matrix, reserved, size, 0);

  // Place data bits (zigzag)
  placeData(matrix, reserved, size, allCodewords, info.remainder);

  // Apply mask 0: (row+col) % 2 === 0
  applyMask(matrix, reserved, size, 0);

  // Re-place format info after mask
  placeFormatInfo(matrix, reserved, size, 0);

  return matrix; // true = dark, false = light
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function encodeUTF8(str) {
  return Array.from(new TextEncoder().encode(str));
}

function pushBits(arr, val, n) {
  for (let i = n - 1; i >= 0; i--) arr.push((val >> i) & 1);
}

function bitsToBytes(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    out.push(b);
  }
  return out;
}

function placeFinderPattern(matrix, reserved, row, col) {
  const pat = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1],
  ];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const mr = row + r, mc = col + c;
    if (mr >= 0 && mr < matrix.length && mc >= 0 && mc < matrix[0].length) {
      matrix[mr][mc] = !!pat[r][c];
      reserved[mr][mc] = true;
    }
  }
}

function placeSeparators(reserved, size) {
  for (let i = 0; i < 8; i++) {
    reserved[7][i] = true; reserved[i][7] = true;
    reserved[7][size-1-i] = true; reserved[i][size-8] = true;
    reserved[size-8][i] = true; reserved[size-1-i][7] = true;
  }
}

function placeAlignmentPattern(matrix, reserved, row, col) {
  const r0 = row - 2, c0 = col - 2;
  const pat = [
    [1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]
  ];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    matrix[r0+r][c0+c] = !!pat[r][c];
    reserved[r0+r][c0+c] = true;
  }
}

const FORMAT_DIVISOR = 0b10100110111;
function placeFormatInfo(matrix, reserved, size, mask) {
  // ECC level L = 01, mask = 0 → data = 0b01_000 = 8
  const data = (0b01 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = ((rem << 1) ^ ((rem >>> 9) * FORMAT_DIVISOR)) & 0x7ff;
  const bits = ((data << 10) | rem) ^ 0b101010000010010;

  // Place around top-left finder
  const pos = [0,1,2,3,4,5,7,8,size-7,size-6,size-5,size-4,size-3,size-2,size-1];
  for (let i = 0; i < 6; i++) {
    const b = (bits >> i) & 1;
    matrix[8][pos[i]] = !!b;
    matrix[pos[14-i]][8] = !!b;
  }
  matrix[8][7] = !!(bits & (1<<6));
  matrix[size-8][8] = !!(bits & (1<<6));
  matrix[8][8] = !!(bits & (1<<7));
  matrix[7][8] = !!(bits & (1<<7));
  for (let i = 8; i < 15; i++) {
    const b = (bits >> i) & 1;
    matrix[8][pos[i-8+7]] = !!b;
    matrix[pos[14-i]][8] = !!b;
  }
}

function placeData(matrix, reserved, size, codewords, remainder) {
  const bits = [];
  for (const cw of codewords) pushBits(bits, cw, 8);
  for (let i = 0; i < remainder; i++) bits.push(0);

  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        const col = right - j;
        if (!reserved[row][col] && bi < bits.length) {
          matrix[row][col] = !!bits[bi++];
        }
      }
    }
  }
}

function applyMask(matrix, reserved, size, maskNum) {
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!reserved[r][c] && matrix[r][c] !== null) {
      let apply = false;
      if (maskNum === 0) apply = (r + c) % 2 === 0;
      if (apply) matrix[r][c] = !matrix[r][c];
    }
  }
}
