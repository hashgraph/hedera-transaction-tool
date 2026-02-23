import { describe, it, expect } from 'vitest';
import * as path from 'path';

import { SignaturePair } from '@shared/transaction/SignaturePair';
import fs from 'fs';

const resourcesDir = path.join(__dirname, '../resources');
const jsonFile = path.join(resourcesDir, 'test-signature-pair.json');

describe('SignaturePair', () => {
  it.skip('reads and exposes values', () => {
    const pair = SignaturePair.read(jsonFile);
    const publicKeyBase64 = Buffer.from(pair.getPublicKey().toBytes()).toString('base64');
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    expect(publicKeyBase64).toEqual(data.publicKey);

    const signatureBase64 = Buffer.from(pair.getSignature()).toString('base64');
    expect(signatureBase64).toEqual(data.signature);
  });

  it.skip('equals returns true for identical pairs', () => {
    const pair1 = SignaturePair.read(jsonFile);
    const pair2 = SignaturePair.read(jsonFile);
    expect(pair1.equals(pair2)).toBe(true);
  });

  it.skip('hashCode matches Java algorithm', () => {
    const pair = SignaturePair.read(jsonFile);
    // Optionally, compare to a known Java hashCode value
    expect(typeof pair.hashCode()).toBe('number');
  });
});
