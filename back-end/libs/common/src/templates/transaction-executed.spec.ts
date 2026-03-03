import { generateTransactionExecutedContent } from '.';
import { Notification } from '@entities';

// back-end/libs/common/src/templates/transaction-executed.spec.ts
describe('generateTransactionExecutedContent - statusCode mapping', () => {
  const makeNotification = (statusCode: any): Notification =>
    ({
      additionalData: {
        statusCode,
        transactionId: 'tx-123',
        network: 'mainnet',
      },
    }) as unknown as Notification;

  it('maps statusCode 0 to SUCCESS', () => {
    const result = generateTransactionExecutedContent(makeNotification(0));
    expect(result).toContain('Status: SUCCESS');
  });

  it('maps statusCode 22 to SUCCESS', () => {
    const result = generateTransactionExecutedContent(makeNotification(22));
    expect(result).toContain('Status: SUCCESS');
  });

  it('maps statusCode 104 to SUCCESS', () => {
    const result = generateTransactionExecutedContent(makeNotification(104));
    expect(result).toContain('Status: SUCCESS');
  });

  it('maps any other numeric statusCode to FAILED', () => {
    const result = generateTransactionExecutedContent(makeNotification(999));
    expect(result).toContain('Status: FAILED');
  });

  it('maps undefined statusCode to FAILED', () => {
    const result = generateTransactionExecutedContent(makeNotification(undefined));
    expect(result).toContain('Status: FAILED');
  });

  it('maps null statusCode to FAILED', () => {
    const result = generateTransactionExecutedContent(makeNotification(null));
    expect(result).toContain('Status: FAILED');
  });

  it('maps non-number statusCode (e.g. string) to FAILED', () => {
    const result = generateTransactionExecutedContent(makeNotification('0'));
    expect(result).toContain('Status: FAILED');
  });
});
