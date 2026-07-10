import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'

import { CreateTransactionGroupDto } from './create-transaction-group.dto'
import { CreateTransactionGroupItemDto } from './create-transaction-group-item.dto'
import { validateSync } from 'class-validator';
import { MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH } from '@entities';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateTransactionGroupDto, plain, { enableImplicitConversion: true })

describe('CreateTransactionGroupDto', () => {
  test('maps plain object -> CreateTransactionGroupDto and converts nested groupItems', () => {
    const plain = {
      description: 'Batch transfer',
      atomic: true,
      sequential: false,
      groupItems: [{ id: 1 }, { id: 2 }],
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(CreateTransactionGroupDto)
    expect((dto as any).description).toBe('Batch transfer')
    expect((dto as any).atomic).toBe(true)
    expect((dto as any).sequential).toBe(false)

    expect(Array.isArray((dto as any).groupItems)).toBe(true)
    expect((dto as any).groupItems[0]).toBeInstanceOf(CreateTransactionGroupItemDto)
    expect((dto as any).groupItems[1]).toBeInstanceOf(CreateTransactionGroupItemDto)
  })

  test('assumes ValidationPipe already converted types: booleans and numeric ids', () => {
    const plain = {
      description: 'Converted booleans',
      // provide already-typed booleans (ValidationPipe would produce these)
      atomic: false,
      sequential: true,
      // provide numeric ids (not strings)
      groupItems: [{ id: 3 }],
    }

    const dto = toDto(plain)

    expect((dto as any).atomic).toBe(false)
    expect((dto as any).sequential).toBe(true)
    expect(Array.isArray((dto as any).groupItems)).toBe(true)
    expect((dto as any).groupItems[0]).toBeInstanceOf(CreateTransactionGroupItemDto)
  })

  test('handles missing or empty groupItems (mapping behavior)', () => {
    const missing = {
      description: 'No items',
      atomic: true,
    }
    const empty = {
      description: 'Empty items',
      atomic: true,
      groupItems: [],
    }

    const dtoMissing = toDto(missing)
    const dtoEmpty = toDto(empty)

    // Mapping expectations: missing -> undefined, empty -> empty array
    expect((dtoMissing as any).groupItems).toBeUndefined()
    expect(Array.isArray((dtoEmpty as any).groupItems)).toBe(true)
    expect((dtoEmpty as any).groupItems.length).toBe(0)
  })

  test('validation fails when description is too long', () => {
    const plain = {
      description: 'a'.repeat(MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH + 1),
      atomic: true,
      sequential: false,
      groupItems: [{ id: 1 }, { id: 2 }],
    };

    const dto = toDto(plain);
    const errors = validateSync(dto as any);
    expect(errors.length).toBeGreaterThan(0);
    const descriptionError = errors.find(e => e.property === 'description');
    expect(descriptionError?.constraints).toHaveProperty('maxLength');
  })
})
