import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { TransactionGroupDto } from './transaction-group.dto'
import { TransactionGroupItemDto } from './transaction-group-item.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(TransactionGroupDto, plain, { enableImplicitConversion: true })

describe('TransactionGroupDto', () => {
  test('maps plain object -> TransactionGroupDto, converts dates and nested items', () => {
    const plain = {
      id: 10,
      description: 'Batch payments',
      atomic: true,
      sequential: false,
      createdAt: '2024-01-10T12:00:00.000Z',
      groupValidTime: '2024-01-11T12:00:00.000Z',
      groupItems: [
        { id: 1 }, // minimal shape; should become TransactionGroupItemDto
        { id: 2 },
      ],
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(TransactionGroupDto)
    expect((dto as any).id).toBe(10)
    expect((dto as any).description).toBe('Batch payments')
    expect((dto as any).atomic).toBe(true)
    expect((dto as any).sequential).toBe(false)

    expect((dto as any).createdAt).toBeInstanceOf(Date)
    expect((dto as any).groupValidTime).toBeInstanceOf(Date)

    expect(Array.isArray((dto as any).groupItems)).toBe(true)
    expect((dto as any).groupItems[0]).toBeInstanceOf(TransactionGroupItemDto)
    expect((dto as any).groupItems[1]).toBeInstanceOf(TransactionGroupItemDto)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('accepts already-typed values (numbers/booleans) for id and groupItems', () => {
    const plain = {
      id: 15,
      description: 'Converted group',
      atomic: false,
      sequential: true,
      createdAt: '2024-02-01T00:00:00.000Z',
      groupValidTime: '2024-02-02T00:00:00.000Z',
      groupItems: [{ id: 7 }],
    }

    const dto = toDto(plain)

    // id is a number
    expect((dto as any).id).toBe(15)
    // booleans preserved
    expect((dto as any).atomic).toBe(false)
    expect((dto as any).sequential).toBe(true)

    expect(Array.isArray((dto as any).groupItems)).toBe(true)
    expect((dto as any).groupItems[0]).toBeInstanceOf(TransactionGroupItemDto)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })
})
