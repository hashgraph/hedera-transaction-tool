import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { TransactionDto, TransactionFullDto } from './transaction.dto'
import { TransactionGroupItemDto } from './transaction-group-item.dto'
import { TransactionSignerUserKeyDto } from './transaction-signer.dto'
import { TransactionApproverDto } from './transaction-approver.dto'
import { TransactionObserverDto } from './transaction-observer.dto'

describe('TransactionDto', () => {
  test('maps plain object -> TransactionDto and applies transforms/types', () => {
    const plain = {
      id: 42,
      name: 'Payment',
      type: 'PAYMENT',
      transactionId: 'tx-123',
      description: 'desc',
      transactionBytes: Buffer.from('deadbeef', 'hex'),
      status: 'PENDING',
      statusCode: 0,
      signature: Buffer.from('beef', 'hex'),
      validStart: '2024-01-01T00:00:00.000Z',
      isManual: false,
      cutoffAt: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-03T00:00:00.000Z',
      executedAt: '2024-01-04T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
      creatorKey: { id: 7, user: { id: 8, email: 'u@example.com' } },
      groupItem: {} // minimal shape; will be converted to TransactionGroupItemDto
    };

    const dto = plainToInstance(TransactionDto, plain, { enableImplicitConversion: true });

    expect(dto).toBeInstanceOf(TransactionDto);
    // transforms set transactionBytes/signature to hex strings
    expect(dto.transactionBytes).toBe('deadbeef');
    expect(dto.signature).toBe('beef');

    // dates should be converted to Date
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.validStart).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    // creator fields derived via transforms
    expect((dto as any).creatorKeyId).toBe(7);
    expect((dto as any).creatorId).toBe(8);
    expect((dto as any).creatorEmail).toBe('u@example.com');

    // nested typed DTO
    expect(dto.groupItem).toBeInstanceOf(TransactionGroupItemDto);

    // no validation rules in this DTO file by default, but ensure validation runs
    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('maps plain object -> TransactionDto with groupItem undefined when omitted', () => {
    const plain = {
      id: 43,
      name: 'Payment2',
      type: 'PAYMENT',
      transactionId: 'tx-124',
      description: 'desc2',
      transactionBytes: Buffer.from('aa', 'hex'),
      status: 'PENDING',
      statusCode: 0,
      signature: Buffer.from('bb', 'hex'),
      validStart: '2024-01-01T00:00:00.000Z',
      isManual: false,
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
      creatorKey: { id: 7, user: { id: 8, email: 'u@example.com' } },
      // groupItem omitted
    };

    const dto = plainToInstance(TransactionDto, plain, { enableImplicitConversion: true });

    expect(dto).toBeInstanceOf(TransactionDto);
    expect(dto.groupItem).toBeUndefined();

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('maps full transaction -> TransactionFullDto with signers/approvers/observers', () => {
    const plainFull = {
      id: 1,
      name: 'FullTx',
      type: 'FULL',
      transactionId: 'tx-full',
      description: 'full',
      transactionBytes: Buffer.from('01', 'hex'),
      signature: Buffer.from('02', 'hex'),
      validStart: '2024-01-01T00:00:00.000Z',
      isManual: true,
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
      creatorKey: { id: 9, user: { id: 10, email: 'creator@example.com' } },
      groupItem: {},
      signers: [{}],
      approvers: [{}],
      observers: [{}]
    };

    const dto = plainToInstance(TransactionFullDto, plainFull, { enableImplicitConversion: true });

    expect(dto).toBeInstanceOf(TransactionFullDto);
    expect(dto.transactionBytes).toBe('01');
    expect(dto.signature).toBe('02');

    expect(dto.signers).toBeInstanceOf(Array);
    expect(dto.signers[0]).toBeInstanceOf(TransactionSignerUserKeyDto);

    expect(dto.approvers).toBeInstanceOf(Array);
    expect(dto.approvers[0]).toBeInstanceOf(TransactionApproverDto);

    expect(dto.observers).toBeInstanceOf(Array);
    expect(dto.observers[0]).toBeInstanceOf(TransactionObserverDto);

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });
});
