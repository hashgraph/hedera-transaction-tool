import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { CreateTransactionDto } from './create-transaction.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateTransactionDto, plain)

describe('CreateTransactionDto', () => {
  test('converts hex strings -> Buffer, dates -> Date, and implicit primitives', () => {
    const plain = {
      name: 'Send',
      description: 'Test payment',
      transactionBytes: 'deadbeef',
      signature: 'beef',
      creatorKeyId: 7,
      mirrorNetwork: 'testnet',
      cutoffAt: '2024-01-02T00:00:00.000Z',
      isManual: false,
      reminderMillisecondsBefore: 60000,
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(CreateTransactionDto)
    // TransformBuffer should produce Buffers from hex strings
    expect((dto as any).transactionBytes).toBeInstanceOf(Buffer)
    expect(((dto as any).transactionBytes as Buffer).toString('hex')).toBe('deadbeef')
    expect((dto as any).signature).toBeInstanceOf(Buffer)
    expect(((dto as any).signature as Buffer).toString('hex')).toBe('beef')

    // Dates and implicit conversions
    expect((dto as any).cutoffAt).toBeInstanceOf(Date)
    expect((dto as any).creatorKeyId).toBe(7)
    expect((dto as any).isManual).toBe(false)
    expect((dto as any).reminderMillisecondsBefore).toBe(60000)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('validation fails when required fields are missing', () => {
    const plain = {
      name: 'Missing fields',
      description: 'No buffers or mirrorNetwork',
    }

    const dto = toDto(plain)
    const errors = validateSync(dto as any)
    expect(errors.length).toBeGreaterThan(0)
  })
})
