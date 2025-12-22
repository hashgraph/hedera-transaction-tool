import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { CreateTransactionGroupItemDto } from './create-transaction-group-item.dto'
import { CreateTransactionDto } from './create-transaction.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateTransactionGroupItemDto, plain)

describe('CreateTransactionGroupItemDto', () => {
  test('maps plain object -> CreateTransactionGroupItemDto and converts nested CreateTransactionDto', () => {
    const plain = {
      seq: 1,
      transaction: {
        name: 'Send',
        description: 'Test payment',
        transactionBytes: 'deadbeef',
        signature: 'beef',
        creatorKeyId: 7,
        mirrorNetwork: 'testnet',
        cutoffAt: '2024-01-02T00:00:00.000Z',
        isManual: false,
        reminderMillisecondsBefore: 60000,
      },
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(CreateTransactionGroupItemDto)
    expect((dto as any).seq).toBe(1)
    expect((dto as any).transaction).toBeInstanceOf(CreateTransactionDto)

    // If CreateTransactionDto has transforms for buffers/dates they should apply
    expect((dto as any).transaction.transactionBytes).toBeInstanceOf(Buffer)
    expect(((dto as any).transaction.transactionBytes as Buffer).toString('hex')).toBe('deadbeef')
    expect((dto as any).transaction.signature).toBeInstanceOf(Buffer)
    expect(((dto as any).transaction.signature as Buffer).toString('hex')).toBe('beef')

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('implicit conversion: seq and nested primitives from strings', () => {
    const plain = {
      seq: 2,
      transaction: {
        name: 'Converted',
        description: 'Implicit conversions',
        transactionBytes: '0a0b',
        signature: '0c',
        creatorKeyId: 9,
        mirrorNetwork: 'preview',
        cutoffAt: '2024-02-02T00:00:00.000Z',
        isManual: true,
        reminderMillisecondsBefore: 120000,
      },
    }

    const dto = toDto(plain)

    // seq string should convert to number
    expect((dto as any).seq).toBe(2)
    // nested conversion: creatorKeyId should become number and isManual boolean if DTO defines transforms/implicit conversion
    expect((dto as any).transaction.creatorKeyId).toBe(9)
    expect((dto as any).transaction.isManual).toBe(true)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('validation fails when seq or transaction is missing or transaction is empty', () => {
    const missingSeq = {
      transaction: {
        name: 'Missing seq',
        description: 'No seq',
        transactionBytes: 'aa',
        signature: 'bb',
        mirrorNetwork: 'testnet',
      },
    }
    const missingTransaction = {
      seq: 1,
    }
    const emptyTransaction = {
      seq: 3,
      transaction: {},
    }

    const dtoMissingSeq = toDto(missingSeq)
    const dtoMissingTransaction = toDto(missingTransaction)
    const dtoEmptyTransaction = toDto(emptyTransaction)

    const errorsMissingSeq = validateSync(dtoMissingSeq as any)
    const errorsMissingTransaction = validateSync(dtoMissingTransaction as any)
    const errorsEmptyTransaction = validateSync(dtoEmptyTransaction as any)

    expect(errorsMissingSeq.length).toBeGreaterThan(0)
    expect(errorsMissingTransaction.length).toBeGreaterThan(0)
    expect(errorsEmptyTransaction.length).toBeGreaterThan(0)
  })
})
