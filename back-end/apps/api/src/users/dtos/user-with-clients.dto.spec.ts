import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'

import { UserWithClientsDto } from './user-with-clients.dto'
import { ClientDto } from './client.dto'
import { UserKeyPublicDto } from '../../user-keys/dtos'
import { UserStatus } from '@entities'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(UserWithClientsDto, plain, { excludeExtraneousValues: true, exposeUnsetFields: false })

describe('UserWithClientsDto', () => {
  test('maps plain object with clients array and converts nested ClientDto instances', () => {
    const plain = {
      id: 1,
      email: 'alice@example.com',
      admin: false,
      status: UserStatus.NEW,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      keys: [],
      clients: [
        { id: 10, version: '1.0.0', updateAvailable: false, createdAt: '2024-01-01', updatedAt: '2024-01-02' },
        { id: 11, version: '1.1.0', updateAvailable: true, createdAt: '2024-02-01', updatedAt: '2024-02-02' },
      ],
    }

    const dto = toDto(plain)
    expect(dto).toBeInstanceOf(UserWithClientsDto)
    expect(dto.clients).toHaveLength(2)
    expect(dto.clients![0]).toBeInstanceOf(ClientDto)
    expect(dto.clients![1]).toBeInstanceOf(ClientDto)
    expect(dto.clients![0].version).toBe('1.0.0')
    expect(dto.clients![1].updateAvailable).toBe(true)
  })

  test('keys are serialized as UserKeyPublicDto — no mnemonicHash or index', () => {
    const plain = {
      id: 1,
      email: 'alice@example.com',
      admin: false,
      status: UserStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      keys: [
        { id: 10, userId: 1, publicKey: 'abc123', mnemonicHash: 'secret', index: 3 },
        { id: 11, userId: 1, publicKey: 'def456', mnemonicHash: null, index: null },
      ],
    }

    const dto = toDto(plain)
    expect(dto.keys).toHaveLength(2)
    expect(dto.keys[0]).toBeInstanceOf(UserKeyPublicDto)
    expect(dto.keys[0].id).toBe(10)
    expect(dto.keys[0].publicKey).toBe('abc123')
    expect(dto.keys[0]).not.toHaveProperty('mnemonicHash')
    expect(dto.keys[0]).not.toHaveProperty('index')
  })
})
