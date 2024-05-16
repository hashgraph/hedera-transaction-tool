import { IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';

import { TransformBuffer } from '@app/common';

export class ApproverChoiceDto {
  @IsNumber()
  @IsNotEmpty()
  userKeyId: number;

  @IsNotEmpty()
  @TransformBuffer()
  signature: Buffer;

  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;
}
