export const encodeUint8Array = (buffer: Uint8Array): string =>
  '0x' + Buffer.from(buffer).toString('hex');

export const decodeUint8Array = (hexString: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hexString.startsWith('0x') ? hexString.slice(2) : hexString, 'hex'));
