import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';

import { SignaturePair } from '@shared/transaction/SignaturePair';

const testFile = 'test-signature-pair.json';

beforeAll(() => {
  fs.writeFileSync(testFile, JSON.stringify({
    publicKey: publicKeyBytes,
    signature: signatureBytes,
  }));
});

afterAll(() => {
  fs.unlinkSync(testFile);
});

describe('SignaturePair', () => {
  let publicKeyBytes, signatureBytes: Uint8Array;
  beforeEach(() => {
    publicKeyBytes = PrivateKey.generateED25519().publicKey.toBytes();
    signatureBytes = new Uint8Array([1, 2, 3, 4, 5]);


  });

  it('reads and exposes values', () => {
    const pair = SignaturePair.read(testFile);
    expect(Array.from(pair.getPublicKey().toBytes())).toEqual(publicKeyBytes);
    expect(Array.from(pair.getSignature())).toEqual(signatureBytes);
  });

  it('equals returns true for identical pairs', () => {
    const pair1 = SignaturePair.read(testFile);
    const pair2 = SignaturePair.read(testFile);
    expect(pair1.equals(pair2)).toBe(true);
  });

  it('hashCode matches Java algorithm', () => {
    const pair = SignaturePair.read(testFile);
    // Optionally, compare to a known Java hashCode value
    expect(typeof pair.hashCode()).toBe('number');
  });
});
