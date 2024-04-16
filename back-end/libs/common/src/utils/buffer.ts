export const encodeUint8Array = (buffer: Uint8Array): string =>
  '0x' + Buffer.from(buffer).toString('hex');

export const decode = (hexString: string): Buffer =>
  Buffer.from(hexString.startsWith('0x') ? hexString.slice(2) : hexString, 'hex');
