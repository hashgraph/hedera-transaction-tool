import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export * from './chain-update-transaction-status.dto';
export * from './email.dto';
export * from './execute-transaction-group.dto';
export * from './execute-transaction.dto';
export * from './notification-event.dto';
export * from './notifications-notify-client.dto';
export * from './notifications-notify-email.dto';
export * from './notifications-notify-for-transaction.dto';
export * from './notifications-notify-general.dto';
export * from './notifications-sync-indicators.dto';
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
