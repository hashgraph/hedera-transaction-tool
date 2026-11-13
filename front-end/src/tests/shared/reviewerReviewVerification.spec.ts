import { PrivateKey } from '@hiero-ledger/sdk';

import {
  buildReviewAttestationMessage,
  verifyReviewSignature,
} from '@shared/utils/reviewerReviewVerification';

const makeReviewer = () => {
  const key = PrivateKey.generateED25519();
  return { key, userKey: { id: 1, publicKey: key.publicKey.toStringRaw() } };
};

describe('review-record verification', () => {
  const reviewer = makeReviewer();
  const stranger = makeReviewer();
  const transactionId = 42;
  const transactionHash = '0xdeadbeef';

  const signReview = (
    m: typeof reviewer,
    accepted: boolean,
    note: string | null,
    hash = transactionHash,
  ) =>
    Buffer.from(m.key.sign(buildReviewAttestationMessage(transactionId, accepted, note, hash))).toString(
      'hex',
    );

  test('not-yet-reviewed rows (no signature) are not verified', () => {
    expect(
      verifyReviewSignature(transactionId, transactionHash, {
        accepted: null,
        note: null,
        userKey: reviewer.userKey,
        signature: null,
      }),
    ).toBeNull();
  });

  test('a genuine signature over the vote and hash verifies', () => {
    const signature = signReview(reviewer, true, 'looks good');
    expect(
      verifyReviewSignature(transactionId, transactionHash, {
        accepted: true,
        note: 'looks good',
        userKey: reviewer.userKey,
        signature,
      }),
    ).toBe('verified');
  });

  test('a missing key is unverifiable, not invalid', () => {
    expect(
      verifyReviewSignature(transactionId, transactionHash, {
        accepted: true,
        note: null,
        userKey: null,
        signature: 'aa',
      }),
    ).toBe('unverifiable');
  });

  test('a signature over different content (vote/note/hash/tx id) is invalid', () => {
    const signature = signReview(reviewer, true, 'looks good');
    const member = { accepted: true, note: 'looks good', userKey: reviewer.userKey, signature };
    expect(verifyReviewSignature(transactionId, transactionHash, { ...member, accepted: false })).toBe(
      'invalid',
    );
    expect(verifyReviewSignature(transactionId, transactionHash, { ...member, note: 'different' })).toBe(
      'invalid',
    );
    expect(verifyReviewSignature(transactionId, 'other-hash', member)).toBe('invalid');
    expect(verifyReviewSignature(99, transactionHash, member)).toBe('invalid');
  });

  test('a signature by someone else entirely is invalid, not unverifiable', () => {
    const signature = signReview(stranger, true, null);
    expect(
      verifyReviewSignature(transactionId, transactionHash, {
        accepted: true,
        note: null,
        userKey: reviewer.userKey,
        signature,
      }),
    ).toBe('invalid');
  });

  test('a malformed hex signature is invalid rather than throwing', () => {
    expect(
      verifyReviewSignature(transactionId, transactionHash, {
        accepted: true,
        note: null,
        userKey: reviewer.userKey,
        signature: 'not-hex',
      }),
    ).toBe('invalid');
  });
});
