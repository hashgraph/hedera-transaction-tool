import { Transform } from 'class-transformer';
import { PublicKey } from '@hashgraph/sdk';

export function NormalizePublicKey() {
  return Transform(({ value }) => {
    if (!value) return value;
    try {
      return PublicKey.fromString(value).toStringRaw();
    } catch {
      // Let validator handle the error
      return value;
    }
  });
}