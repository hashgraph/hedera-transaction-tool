import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  transactionRequiredSignature?: boolean;

  @IsBoolean()
  @IsOptional()
  transactionReadyForExecution?: boolean;
}
