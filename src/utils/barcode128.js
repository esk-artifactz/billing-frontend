/**
 * Code 128 barcode renderer — pure JS, draws onto a given Canvas element.
 * Supports ASCII 32-126 (Code B subset).
 *
 * Usage:
 *   drawBarcode128(canvasEl, text, { height, barWidth, color, background })
 */

// Code 128 B encoding table
// Each value = 11-bit bar pattern (1=bar, 0=space), MSB first
const CODE128B_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11010111000','11010001110','11000010110',  // 58
  '11010111000','11010001110','11000010110',                               // dups pad to 64
  '10111101000','10100011110','10001111010','10111100010','10011110100',
  '10001111010','11110010010','11110100010','10111011110','10111101110',
  '11110100110','11010110000','11010000110','11000010110','10010110000',   // 79
  '10010000110','10000010110','10110100000','10110000100','10011010000',
  '10011000010','10000110100','10000110010','11000010010','11001010000',
  '11110111010','11000010100','10001111010','10100111100','10010111100',   // 94
  '10010011110','10111100100','10011110010','11110100100','11110010100',   // 99
  '11110010010','11011011110','11011110110','11110110110','10101111000',   // 104 START B
  '10100011110','10001011110',                                             // 105 START C, 106 STOP-pre
  '11000111010','11110101000','11111010100','11111010010',                 // STOP variants
];

// Code 128B value for a printable ASCII char (space=0 .. ~=94)
function charValue(ch) { return ch.charCodeAt(0) - 32; }

// START B = pattern index 104, STOP = special
const START_B_PAT  = '11010010000';
const STOP_PAT     = '1100011101011';

function encode128B(text) {
  const patterns = [START_B_PAT];
  let checksum = 104; // START B value
  for (let i = 0; i < text.length; i++) {
    const v = charValue(text[i]);
    checksum += (i + 1) * v;
    patterns.push(CODE128B_PATTERNS[v] || CODE128B_PATTERNS[0]);
  }
  checksum %= 103;
  patterns.push(CODE128B_PATTERNS[checksum]);
  patterns.push(STOP_PAT);
  return patterns.join('');
}

/**
 * Draw a Code-128B barcode on `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {string} text          - text to encode (ASCII 32-126)
 * @param {object} opts
 *   barWidth   {number} px per module (default 2)
 *   height     {number} bar height px (default 60)
 *   color      {string} bar colour (default '#000')
 *   background {string} bg colour  (default '#fff')
 *   quiet      {number} quiet zone modules each side (default 10)
 */
export function drawBarcode128(canvas, text, opts = {}) {
  if (!canvas || !text) return;
  const barWidth   = opts.barWidth   || 2;
  const barHeight  = opts.height     || 60;
  const color      = opts.color      || '#000';
  const bg         = opts.background || '#fff';
  const quiet      = opts.quiet      || 10;

  const bits = encode128B(text);
  const totalWidth = (bits.length + quiet * 2) * barWidth;

  canvas.width  = totalWidth;
  canvas.height = barHeight;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, totalWidth, barHeight);

  ctx.fillStyle = color;
  const offsetX = quiet * barWidth;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      ctx.fillRect(offsetX + i * barWidth, 0, barWidth, barHeight);
    }
  }
}
