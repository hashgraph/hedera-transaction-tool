import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { UserDto } from './user.dto'
import { UserKeyDto } from '../../user-keys/dtos';
import { UserStatus } from '@entities'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(UserDto, plain, { enableImplicitConversion: false })

describe('UserDto', () => {
  test('maps plain object to UserDto and converts nested UserKeyDto and dates', () => {
    const plain = {
      id: 1,
      email: 'alice@example.com',
      admin: false,
      status: UserStatus.NEW,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      keys: { id: 10, key: 'abc' }
    }

    const dto = toDto(plain)
    expect(dto).toBeInstanceOf(UserDto)
    expect(dto.id).toBe(1)
    expect(dto.email).toBe('alice@example.com')
    expect(dto.keys).toBeInstanceOf(UserKeyDto)
    expect(dto.createdAt).toBeInstanceOf(Date)
    expect(dto.updatedAt).toBeInstanceOf(Date)
  })

  test('fails validation when enum is invalid', () => {
    const invalidPlain = {
      id: 2,
      email: 'bob@example.com',
      admin: true,
      status: 'INVALID_STATUS',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      keys: {}
    }

    const instance = toDto(invalidPlain)
    const errors = validateSync(instance)
    expect(errors.length).toBeGreaterThan(0)
    const enumErrors = errors.flatMap(e => (e.constraints ? Object.keys(e.constraints) : []))
    expect(enumErrors.some(k => k.toLowerCase().includes('isenum'))).toBe(true)
  })
})
