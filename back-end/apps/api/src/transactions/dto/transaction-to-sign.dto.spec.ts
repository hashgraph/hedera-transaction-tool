import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { TransactionToSignDto } from './transaction-to-sign.dto'
import { TransactionDto } from './transaction.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(TransactionToSignDto, plain, { enableImplicitConversion: true })

describe('TransactionToSignDto', () => {
  test('maps plain object -> TransactionToSignDto and converts nested TransactionDto', () => {
    const plain = {
      transaction: {
        id: 20,
        transactionBytes: Buffer.from('01', 'hex'),
        signature: Buffer.from('02', 'hex'),
        validStart: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
        groupItem: {},
      },
      keysToSign: [1, 2, 3],
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(TransactionToSignDto)
    expect(dto.transaction).toBeInstanceOf(TransactionDto)

    expect((dto.transaction as any).transactionBytes).toBe('01')
    expect((dto.transaction as any).signature).toBe('02')

    expect((dto.transaction as any).createdAt).toBeInstanceOf(Date)
    expect((dto.transaction as any).validStart).toBeInstanceOf(Date)

    expect(Array.isArray(dto.keysToSign)).toBe(true)
    expect(dto.keysToSign).toEqual([1, 2, 3])

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('accepts already-typed values for keysToSign (ValidationPipe performs transforms)', () => {
    const plain = {
      transaction: {
        id: 21,
        transactionBytes: Buffer.from('0a', 'hex'),
        signature: Buffer.from('0b', 'hex'),
        validStart: '2024-02-01T00:00:00.000Z',
        createdAt: '2024-02-03T00:00:00.000Z',
        updatedAt: '2024-02-05T00:00:00.000Z',
        groupItem: {},
      },
      // assume incoming values have already been converted by ValidationPipe
      keysToSign: [4, 5],
    }

    const dto = toDto(plain)

    expect(dto.keysToSign).toEqual([4, 5])

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })
})
