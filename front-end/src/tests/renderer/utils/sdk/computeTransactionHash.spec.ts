import { describe, expect, test } from 'vitest';
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import { computeTransactionHash } from '@renderer/utils/sdk';

const buildUnfrozen = (memo = 'memo') =>
  new AccountCreateTransaction()
    .setKeyWithoutAlias(PrivateKey.generateED25519().publicKey)
    .setInitialBalance(new Hbar(1))
    .setTransactionMemo(memo)
    .setTransactionId(
      TransactionId.withValidStart(AccountId.fromString('0.0.1234'), Timestamp.fromDate(new Date())),
    );

describe('computeTransactionHash', () => {
  test('returns null for bytes that were never frozen', async () => {
    const unfrozenBytes = buildUnfrozen().toBytes();
    expect(await computeTransactionHash(unfrozenBytes)).toBeNull();
  });

  test('matches an independent getTransactionHash() computation over the same bytes', async () => {
    const client = Client.forTestnet();
    const frozenBytes = buildUnfrozen().freezeWith(client).toBytes();
    client.close();

    // Re-parses the bytes into a separate Transaction instance, the same way the back-end
    // (and a second front-end call) would, rather than reusing the object that produced them.
    const independentHash = await (
      AccountCreateTransaction.fromBytes(frozenBytes) as AccountCreateTransaction
    ).getTransactionHash();
    const expected = '0x' + Buffer.from(independentHash).toString('hex');

    expect(await computeTransactionHash(frozenBytes)).toBe(expected);
  });

  test('is deterministic: parsing the same frozen bytes twice gives the same hash', async () => {
    const client = Client.forTestnet();
    const frozenBytes = buildUnfrozen().freezeWith(client).toBytes();
    client.close();

    const first = await computeTransactionHash(frozenBytes);
    const second = await computeTransactionHash(frozenBytes.slice());
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  test('different transaction content hashes differently', async () => {
    const client = Client.forTestnet();
    const a = buildUnfrozen('a').freezeWith(client).toBytes();
    const b = buildUnfrozen('b').freezeWith(client).toBytes();
    client.close();

    expect(await computeTransactionHash(a)).not.toBe(await computeTransactionHash(b));
  });

  test('still frozen after another signer adds a signature - hash reflects the stored bytes as-is', async () => {
    // unsignedTransactionBytes is captured once at upload and never re-signed, so this case
    // shouldn't occur against real data, but the function must not throw if it does.
    const client = Client.forTestnet();
    const tx = buildUnfrozen().freezeWith(client);
    client.close();
    tx.sign(PrivateKey.generateED25519());

    expect(await computeTransactionHash(tx.toBytes())).toMatch(/^0x[0-9a-f]+$/);
  });
});
