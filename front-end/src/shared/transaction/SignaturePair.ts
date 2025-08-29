import { PublicKey } from '@hashgraph/sdk';
import * as fs from 'fs';
import { areByteArraysEqual, javaFormatArrayHashCode } from '../utils/byteUtils';

export class SignaturePair {
  public readonly publicKey: Uint8Array;
  public readonly signature: Uint8Array;

  private constructor(publicKey: Uint8Array, signature: Uint8Array) {
    this.publicKey = publicKey;
    this.signature = signature;
  }

  static read(filePath: string): SignaturePair {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const publicKey = Uint8Array.from(data.publicKey);
    const signature = Uint8Array.from(data.signature);
    return new SignaturePair(publicKey, signature);
  }

  getPublicKey(): PublicKey {
    return PublicKey.fromBytes(this.publicKey);
  }

  getSignature(): Uint8Array {
    return this.signature;
  }

  equals(obj: unknown): boolean {
    if (!(obj instanceof SignaturePair)) return false;
    if (obj === this) return true;
    return (
      areByteArraysEqual(this.publicKey, obj.publicKey) &&
      areByteArraysEqual(this.signature, obj.signature)
    );
  }

  hashCode(): number {
    return javaFormatArrayHashCode(this.signature);
  }
}
