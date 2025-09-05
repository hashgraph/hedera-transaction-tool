export function areByteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function javaFormatArrayHashCode(bytes) {
  let result = 1;
  for (let i = 0; i < bytes.length; i++) {
    result = (31 * result + (bytes[i] & 0xFF)) | 0; // force 32-bit signed int
  }
  return result;
}
