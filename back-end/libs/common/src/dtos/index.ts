import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export * from './chain-update-transaction-status.dto';
export * from './dismissed-notification.dto';
export * from './email.dto';
export * from './notification-event.dto';
export * from './notifications-notify-client.dto';
export * from './paginated-resource.dto';
export * from './transaction-executed.dto';
export * from './transaction-group-executed.dto';

export async function transformAndValidateDto<T extends object>(
  dtoClass: new (...args: any[]) => T,
  payload: T | T[],
): Promise<T[]> {
  const items = Array.isArray(payload) ? payload : [payload];
  const instances = items.map(item => plainToInstance(dtoClass, item));
  await Promise.all(instances.map(instance => validateOrReject(instance)));
  return instances;
}
