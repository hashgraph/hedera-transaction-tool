import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class NotificationEventDto {
  @IsNotEmpty()
  @IsNumber()
  entityId: number;

  @IsOptional()
  additionalData?: Record<string, any>;
}