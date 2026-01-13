import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'

import { LoginResponseDto } from './login-response.dto'
import { UserDto } from '../../users/dtos'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(LoginResponseDto, plain)

describe('LoginResponseDto', () => {
  test('maps plain object -> LoginResponseDto and converts nested UserDto', () => {
    const plain = {
      user: { id: 1, email: 'user@example.com' },
      accessToken: 'token-xyz',
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(LoginResponseDto)
    expect((dto as any).accessToken).toBe('token-xyz')

    // @Type(() => UserDto) should convert the plain nested object into UserDto
    expect((dto as any).user).toBeInstanceOf(UserDto)
    expect((dto as any).user.id).toBe(1)
  })
})
