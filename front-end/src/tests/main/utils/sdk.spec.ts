import { expect } from 'vitest';

import { getStatusCodeFromMessage } from '@main/utils/sdk';
import { Status } from '@hashgraph/sdk';

describe('SDK utilities', () => {
  test('getStatusCodeFromMessage: Returns correct code for TransactionExpired if message includes TRANSACTION_EXPIRED', () => {
    const message = 'This is an error message for TRANSACTION_EXPIRED';

    const status = getStatusCodeFromMessage(message);

    expect(status).toEqual(Status.TransactionExpired._code);
  });

  test('getStatusCodeFromMessage: Returns correct code for Unknow if message is unknown', () => {
    const message = 'This is an unknown error';

    const status = getStatusCodeFromMessage(message);

    expect(status).toEqual(Status.Unknown._code);
  });
});
