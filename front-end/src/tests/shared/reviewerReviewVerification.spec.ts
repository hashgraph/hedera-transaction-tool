import { PrivateKey } from '@hashgraph/sdk';

import {
  buildReviewAttestationMessage,
  indexCurrentReviewerKeys,
  verifyReviewSignature,
} from '@shared/utils/reviewerReviewVerification';

let nextId = 1;
const makeReviewer = () => {
  const id = nextId++;
  return { userId: id, userKeyId: 100 + id, key: PrivateKey.generateED25519() };
};

describe('review-record verification', () => {
  const [reviewer, departedReviewer, stranger] = [makeReviewer(), makeReviewer(), makeReviewer()];
  const currentKeys = indexCurrentReviewerKeys([
    {
      members: [reviewer].map(m => ({
        userId: m.userId,
        userKeyId: m.userKeyId,
        publicKey: m.key.publicKey.toStringRaw(),
      })),
    },
  ]);
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
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: null, note: null, userKeyId: reviewer.userKeyId, signature: null },
        currentKeys,
      ),
    ).toBeNull();
  });

  test('a genuine signature over the current members and hash verifies', () => {
    const signature = signReview(reviewer, true, 'looks good');
    expect(
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: true, note: 'looks good', userKeyId: reviewer.userKeyId, signature },
        currentKeys,
      ),
    ).toBe('verified');
  });

  test('a key not found among current members is unverifiable, not invalid', () => {
    const signature = signReview(departedReviewer, true, null);
    expect(
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: true, note: null, userKeyId: departedReviewer.userKeyId, signature },
        currentKeys,
      ),
    ).toBe('unverifiable');
  });

  test('a null userKeyId is unverifiable', () => {
    expect(
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: true, note: null, userKeyId: null, signature: 'aa' },
        currentKeys,
      ),
    ).toBe('unverifiable');
  });

  test('a signature over different content (vote/note/hash/tx id) is invalid', () => {
    const signature = signReview(reviewer, true, 'looks good');
    const member = {
      accepted: true,
      note: 'looks good',
      userKeyId: reviewer.userKeyId,
      signature,
    };
    expect(
      verifyReviewSignature(transactionId, transactionHash, { ...member, accepted: false }, currentKeys),
    ).toBe('invalid');
    expect(
      verifyReviewSignature(transactionId, transactionHash, { ...member, note: 'different' }, currentKeys),
    ).toBe('invalid');
    expect(verifyReviewSignature(transactionId, 'other-hash', member, currentKeys)).toBe('invalid');
    expect(verifyReviewSignature(99, transactionHash, member, currentKeys)).toBe('invalid');
  });

  test('a signature by someone else entirely is invalid, not unverifiable', () => {
    const signature = signReview(stranger, true, null);
    const keysWithStranger = indexCurrentReviewerKeys([
      {
        members: [reviewer, stranger].map(m => ({
          userId: m.userId,
          userKeyId: m.userKeyId,
          publicKey: m.key.publicKey.toStringRaw(),
        })),
      },
    ]);
    expect(
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: true, note: null, userKeyId: reviewer.userKeyId, signature },
        keysWithStranger,
      ),
    ).toBe('invalid');
  });

  test('a malformed hex signature is invalid rather than throwing', () => {
    expect(
      verifyReviewSignature(
        transactionId,
        transactionHash,
        { accepted: true, note: null, userKeyId: reviewer.userKeyId, signature: 'not-hex' },
        currentKeys,
      ),
    ).toBe('invalid');
  });
});
