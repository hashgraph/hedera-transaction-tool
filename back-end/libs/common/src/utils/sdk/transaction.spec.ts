import {
  AccountCreateTransaction,
  AccountId,
  PrivateKey,
  Transaction as SDKTransaction,
  TransactionId,
} from '@hiero-ledger/sdk';

import { validateSignature } from './transaction';

describe('validateSignature', () => {
  const createFrozenTransaction = () =>
    new AccountCreateTransaction()
      .setTransactionId(TransactionId.generate('0.0.2'))
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .freeze();

  it('returns both allPublicKeys and newPublicKeys for a valid new signature', async () => {
    const privateKey = PrivateKey.generateECDSA();
    const unsigned = createFrozenTransaction();
    const unsignedBytes = unsigned.toBytes();

    await unsigned.sign(privateKey);
    const result = validateSignature(
      SDKTransaction.fromBytes(unsignedBytes),
      unsigned.getSignatures(),
    );

    expect(result.allPublicKeys).toEqual([privateKey.publicKey]);
    expect(result.newPublicKeys).toEqual([privateKey.publicKey]);
  });

  it('returns empty newPublicKeys when the key already signed the transaction', async () => {
    const privateKey = PrivateKey.generateECDSA();
    const signed = createFrozenTransaction();
    await signed.sign(privateKey);

    const result = validateSignature(
      SDKTransaction.fromBytes(signed.toBytes()),
      signed.getSignatures(),
    );

    expect(result.allPublicKeys).toEqual([privateKey.publicKey]);
    expect(result.newPublicKeys).toEqual([]);
  });

  it('throws when an already-signed key has invalid signature bytes in the map', async () => {
    const privateKey = PrivateKey.generateECDSA();
    const signed = createFrozenTransaction();
    await signed.sign(privateKey);
    const signatureMap = signed.getSignatures() as any;

    outer: for (const [, transactionIds] of signatureMap._map) {
      for (const [, publicKeys] of transactionIds._map) {
        for (const [publicKeyDer, signature] of publicKeys._map) {
          const tampered = Uint8Array.from(signature);
          tampered[0] = tampered[0] ^ 0xff;
          publicKeys._map.set(publicKeyDer, tampered);
          break outer;
        }
      }
    }

    expect(() =>
      validateSignature(
        SDKTransaction.fromBytes(signed.toBytes()),
        signatureMap,
      ),
    ).toThrow('Invalid signature');
  });
});
