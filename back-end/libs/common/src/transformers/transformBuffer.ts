import { Transform } from 'class-transformer';

export const TransformBuffer = () =>
  Transform(({ value }) =>
    value ? Buffer.from(value.startsWith('0x') ? value.slice(2) : value, 'hex') : null,
  );
