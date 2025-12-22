import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { NotificationReceiverDto } from './notification-receiver.dto'
import { NotificationDto } from './notification.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(NotificationReceiverDto, plain, { enableImplicitConversion: true })

describe('NotificationReceiverDto', () => {
  test('maps plain object -> NotificationReceiverDto and converts nested NotificationDto (ValidationPipe-like values)', () => {
    const plain = {
      id: 5,
      notification: { id: 10, title: 'Test notification' },
      notificationId: 10,
    }

    const dto = toDto(plain)

    expect(dto).toBeInstanceOf(NotificationReceiverDto)
    expect((dto as any).id).toBe(5)

    expect((dto as any).notification).toBeInstanceOf(NotificationDto)
    expect((dto as any).notification.id).toBe(10)
    expect((dto as any).notification.title).toBe('Test notification')

    expect((dto as any).notificationId).toBe(10)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('DTO performs implicit conversion: numeric-like strings -> numbers for id and notificationId and nested id', () => {
    const plain = {
      id: '7',
      notification: { id: '9', title: 'Converted' },
      notificationId: '8',
    }

    const dto = toDto(plain)

    // ensure class-transformer converted the numeric-like strings to numbers
    expect((dto as any).id).toBe(7)
    expect((dto as any).notificationId).toBe(8)

    expect((dto as any).notification).toBeInstanceOf(NotificationDto)
    expect((dto as any).notification.id).toBe(9)
    expect((dto as any).notification.title).toBe('Converted')

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })
})
