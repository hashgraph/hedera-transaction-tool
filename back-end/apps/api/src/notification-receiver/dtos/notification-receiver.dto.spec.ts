import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'

import { NotificationReceiverDto } from './notification-receiver.dto'
import { NotificationDto } from './notification.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(NotificationReceiverDto, plain)

describe('NotificationReceiverDto', () => {
  test('maps plain object and converts nested NotificationDto via @Type decorator', () => {
    const plain = {
      id: 1,
      notificationId: 10,
      isRead: false,
      notification: {
        id: 10,
        type: 'TRANSACTION_CREATED',
        content: 'A new transaction was created',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    }

    const dto = toDto(plain)
    expect(dto).toBeInstanceOf(NotificationReceiverDto)
    expect(dto.notification).toBeInstanceOf(NotificationDto)
    expect(dto.notification.type).toBe('TRANSACTION_CREATED')
    expect(dto.isRead).toBe(false)
  })
})
