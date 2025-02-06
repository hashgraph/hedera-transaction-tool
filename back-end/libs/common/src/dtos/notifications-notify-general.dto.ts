import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { NotificationType } from '../database/entities';

export class NotifyGeneralDto {
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  userIds: number[];

  @IsNotEmpty()
  content: string;

  @IsOptional()
  entityId?: number;

  @IsOptional()
  actorId?: number;

  @IsOptional()
  additionalData?: Record<string, any>;

  @IsOptional()
  recreateReceivers?: boolean;
}
