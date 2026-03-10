import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { CancelFailureCode, CancelGroupResultDto } from './cancel-group-result.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CancelGroupResultDto, plain, { enableImplicitConversion: true })

describe('CancelGroupResultDto', () => {
  test('maps plain object and converts nested @Type() properties', () => {
    const plain = {
      canceled: [1, 2],
      alreadyCanceled: [3],
      failed: [
        { id: 4, code: CancelFailureCode.NOT_CANCELABLE, message: 'Cannot cancel' },
      ],
      summary: { total: 4, canceled: 2, alreadyCanceled: 1, failed: 1 },
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(CancelGroupResultDto)
    expect(dto.canceled).toEqual([1, 2])
    expect(dto.alreadyCanceled).toEqual([3])
    expect(dto.failed).toHaveLength(1)
    expect(dto.failed[0].id).toBe(4)
    expect(dto.failed[0].code).toBe(CancelFailureCode.NOT_CANCELABLE)
    expect(dto.summary.total).toBe(4)
    expect(dto.summary.canceled).toBe(2)
  })
})
