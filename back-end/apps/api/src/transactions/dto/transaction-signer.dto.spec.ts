import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import {
  TransactionSignerDto,
  TransactionSignerUserKeyDto,
  TransactionSignerFullDto,
} from './transaction-signer.dto'
import { UserKeyCoreDto } from '../../user-keys/dtos'
import { TransactionDto } from './transaction.dto'

const toDto = <T>(cls: new () => T, plain: Record<string, unknown>) =>
  plainToInstance(cls, plain, { enableImplicitConversion: true })

describe('TransactionSigner DTOs', () => {
  test('maps minimal TransactionSignerDto and preserves createdAt as Date', () => {
    const now = new Date()
    const dto = toDto(TransactionSignerDto, {
      id: 1,
      transactionId: 2,
      userKeyId: 3,
      createdAt: now,
    })

    expect(dto).toBeInstanceOf(TransactionSignerDto)
    expect((dto as any).id).toBe(1)
    expect((dto as any).transactionId).toBe(2)
    expect((dto as any).userKeyId).toBe(3)
    expect((dto as any).createdAt).toBeInstanceOf(Date)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('maps TransactionSignerUserKeyDto and converts userKey to UserKeyCoreDto', () => {
    const dto = toDto(TransactionSignerUserKeyDto, {
      id: 4,
      transactionId: 5,
      userKey: { id: 10 },
      createdAt: new Date(),
    })

    expect(dto).toBeInstanceOf(TransactionSignerUserKeyDto)
    expect((dto as any).userKey).toBeInstanceOf(UserKeyCoreDto)
    expect(((dto as any).userKey as any).id).toBe(10)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('maps TransactionSignerFullDto and converts transaction and userKey', () => {
    const dto = toDto(TransactionSignerFullDto, {
      id: 6,
      transaction: {
        id: 20,
        // include buffers so TransactionDto transforms don't fail
        transactionBytes: Buffer.from('01', 'hex'),
        signature: Buffer.from('02', 'hex'),
        validStart: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
        groupItem: {}, // required typed property
      },
      userKey: { id: 30 },
      createdAt: new Date(),
    })

    expect(dto).toBeInstanceOf(TransactionSignerFullDto)
    expect((dto as any).transaction).toBeInstanceOf(TransactionDto)
    expect((dto as any).userKey).toBeInstanceOf(UserKeyCoreDto)
    expect(((dto as any).transaction as any).id).toBe(20)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })
})
