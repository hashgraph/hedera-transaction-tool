import { Expose } from 'class-transformer';

export class NotificationPreferencesDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  transactionRequiredSignature: boolean;

  @Expose()
  transactionReadyForExecution: boolean;
}
