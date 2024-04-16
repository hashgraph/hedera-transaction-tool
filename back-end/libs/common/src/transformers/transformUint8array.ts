import { Transform } from 'class-transformer';

export const TransforToUint8Array = () =>
  Transform(({ value }) =>
    value
      ? Uint8Array.from(Buffer.from(value.startsWith('0x') ? value.slice(2) : value, 'hex'))
      : null,
  );
