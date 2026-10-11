/**
 * QR Code generator — wraps the proven `qrcode` npm library.
 * Returns a 2-D boolean matrix (true = dark module), same API as before.
 */
import QRCode from 'qrcode';

export function generateQR(text) {
  const qr = QRCode.create(String(text), { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const matrix = [];
  for (let r = 0; r < size; r++) {
    const row = new Array(size);
    for (let c = 0; c < size; c++) row[c] = !!data[r * size + c];
    matrix.push(row);
  }
  return matrix;
}
