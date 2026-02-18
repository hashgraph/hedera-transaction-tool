import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'

import { UserWithClientsDto } from './user-with-clients.dto'
import { ClientDto } from './client.dto'
import { UserStatus } from '@entities'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(UserWithClientsDto, plain)

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
    expect(dto.clients[0]).toBeInstanceOf(ClientDto)
    expect(dto.clients[1]).toBeInstanceOf(ClientDto)
    expect(dto.clients[0].version).toBe('1.0.0')
    expect(dto.clients[1].updateAvailable).toBe(true)
  })
})
