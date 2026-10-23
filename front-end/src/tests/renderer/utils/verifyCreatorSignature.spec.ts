import { describe, expect, test } from 'vitest';
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  FileUpdateTransaction,
  Hbar,
  PrivateKey,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import { verifyCreatorSignature } from '@renderer/utils/sdk';

const creatorKey = PrivateKey.generateED25519();
const otherKey = PrivateKey.generateED25519();

const buildUnfrozen = () =>
  new AccountCreateTransaction()
    .setKeyWithoutAlias(creatorKey.publicKey)
    .setInitialBalance(new Hbar(1))
    .setTransactionMemo('memo')
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString('0.0.1234'),
        Timestamp.fromDate(new Date()),
      ),
    );

// What the server does with whatever the client sent
const serverFreeze = (bytes: Uint8Array) => {
  const client = Client.forTestnet();
  const tx = AccountCreateTransaction.fromBytes(bytes) as AccountCreateTransaction;
  if (!tx.isFrozen()) tx.freezeWith(client);
  client.close();
  return tx;
};

describe('verifyCreatorSignature', () => {
  test('accepts a transaction frozen by the creator, even after others signed it', () => {
    const client = Client.forTestnet();
    const signedBytes = buildUnfrozen().freezeWith(client).toBytes();
    client.close();
    const signature = creatorKey.sign(signedBytes);

    const stored = serverFreeze(signedBytes);
    stored.sign(otherKey);
    stored.sign(creatorKey);

    expect(
      verifyCreatorSignature(creatorKey.publicKey, stored.toBytes(), signedBytes, signature),
    ).toBe(true);
  });

  test('does not verify a transaction signed unfrozen (older client)', () => {
    const client = Client.forTestnet();
    const signedBytes = buildUnfrozen().toBytes();
    const stored = serverFreeze(signedBytes);
    client.close();

    expect(
      verifyCreatorSignature(
        creatorKey.publicKey,
        stored.toBytes(),
        signedBytes,
        creatorKey.sign(signedBytes),
      ),
    ).toBe(false);
  });

  test('rejects a signature from another key', () => {
    const client = Client.forTestnet();
    const signedBytes = buildUnfrozen().freezeWith(client).toBytes();
    client.close();

    expect(
      verifyCreatorSignature(
        creatorKey.publicKey,
        signedBytes,
        signedBytes,
        otherKey.sign(signedBytes),
      ),
    ).toBe(false);
  });

  test('rejects served bytes that differ from the signed ones', () => {
    const client = Client.forTestnet();
    const signedBytes = buildUnfrozen().freezeWith(client).toBytes();
    const signature = creatorKey.sign(signedBytes);
    const altered = buildUnfrozen().setTransactionMemo('altered').freezeWith(client);
    client.close();

    expect(
      verifyCreatorSignature(creatorKey.publicKey, altered.toBytes(), signedBytes, signature),
    ).toBe(false);
  });

  test('rejects a different transaction frozen for the same nodes', () => {
    const client = Client.forTestnet();
    const signedBytes = buildUnfrozen().freezeWith(client).toBytes();
    const signature = creatorKey.sign(signedBytes);
    const other = buildUnfrozen().setTransactionMemo('other').freezeWith(client);
    client.close();

    expect(
      verifyCreatorSignature(creatorKey.publicKey, other.toBytes(), signedBytes, signature),
    ).toBe(false);
  });

  test('works for a FileUpdate with contents', () => {
    const client = Client.forTestnet();
    const unfrozen = new FileUpdateTransaction()
      .setFileId('0.0.150')
      .setContents(new Uint8Array(500).fill(7))
      .setTransactionId(
        TransactionId.withValidStart(AccountId.fromString('0.0.2'), Timestamp.fromDate(new Date())),
      );
    const signedBytes = unfrozen.freezeWith(client).toBytes();
    const signature = creatorKey.sign(signedBytes);
    const stored = FileUpdateTransaction.fromBytes(signedBytes);
    stored.sign(otherKey);
    client.close();

    expect(
      verifyCreatorSignature(creatorKey.publicKey, stored.toBytes(), signedBytes, signature),
    ).toBe(true);
  });
});
