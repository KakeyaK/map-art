/**
 * Browsers write JPEGs with a JFIF header that says "no units, 1:1 aspect", so
 * print software falls back to 72 dpi and shows a huge physical size. Rewrite
 * the density fields so the file opens at the intended print size.
 */
export function setJfifDpi(bytes: Uint8Array, dpi: number): boolean {
  const isJfif =
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    String.fromCharCode(...bytes.subarray(6, 11)) === 'JFIF\0';
  if (!isJfif) return false;
  const d = Math.round(dpi);
  bytes[13] = 1; // units: dots per inch
  bytes[14] = d >> 8;
  bytes[15] = d & 0xff;
  bytes[16] = d >> 8;
  bytes[17] = d & 0xff;
  return true;
}
