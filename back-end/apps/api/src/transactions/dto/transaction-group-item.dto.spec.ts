import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { TransactionDto } from './transaction.dto'
import { TransactionGroupItemDto } from './transaction-group-item.dto'
import { TransactionGroupDto } from './transaction-group.dto';

describe('TransactionGroupItemDto', () => {
  test('maps plain object -> TransactionGroupItemDto and applies transforms/types', () => {
    const plain = {
      transactionId: 42,
      groupId: 7,
      seq: 1,
      group: {
        id: 7,
        description: 'My Group'
      },
      transaction: {
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
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
        creatorKey: { id: 7, user: { id: 8, email: 'u@example.com' } }
      }
    };

    const dto = plainToInstance(TransactionGroupItemDto, plain, { enableImplicitConversion: true });

    expect(dto).toBeInstanceOf(TransactionGroupItemDto);

    // nested types created via @Type()
    expect(dto.group).toBeInstanceOf(TransactionGroupDto);
    expect(dto.transaction).toBeInstanceOf(TransactionDto);

    // TransactionDto transforms still apply when nested (buffers -> hex, strings -> Date)
    expect(dto.transaction.transactionBytes).toBe('deadbeef');
    expect(dto.transaction.signature).toBe('beef');
    expect(dto.transaction.validStart).toBeInstanceOf(Date);
    expect(dto.transaction.createdAt).toBeInstanceOf(Date);
    expect(dto.transaction.updatedAt).toBeInstanceOf(Date);

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });
});
