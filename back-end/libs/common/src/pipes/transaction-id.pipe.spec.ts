import { TransactionId } from '@hashgraph/sdk';

import { TransactionIdPipe } from '@app/common/pipes/transaction-id.pipe';

describe('TransactionIdPipe', () => {
  let pipe: TransactionIdPipe;

  beforeEach(() => {
    pipe = new TransactionIdPipe();
  });

  it('should transform a valid transaction ID string to TransactionId', async () => {
    const input = '0.0.123@15648433.000112315';
    const result = await pipe.transform(input);
    expect(result).toBeInstanceOf(TransactionId);
    expect(result.toString()).toBe(input);
  });

  it('should return a number if input is a number', async () => {
    const result = await pipe.transform('42');
    expect(result).toBe(42);
  });

  it('should throw an error for invalid input', () => {
    expect(() => pipe.transform('invalid')).toThrow();
  });
});