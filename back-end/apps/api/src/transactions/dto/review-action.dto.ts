import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { ReviewSignatureDto } from './review-signature.dto';

export class ReviewActionDto {
  @IsBoolean()
  @IsNotEmpty()
  accepted!: boolean;

  @ValidateIf(o => o.accepted === false)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  note?: string;

  @ApiProperty({
    type: [ReviewSignatureDto],
    description:
      'One or more (userKeyId, signature) pairs, one per distinct key the reviewer holds ' +
      'across their pending memberships on this transaction. Each signature is a hex-encoded ' +
      'Ed25519 signature over the review attestation message ' +
      '(transactionId:ACCEPT|REJECT:note:transactionHash) produced with the paired userKeyId. ' +
      'This does not sign the transaction itself. A reviewer with pending memberships under ' +
      'multiple keys only needs to submit signatures for the keys they have available; ' +
      'memberships tied to keys not covered here are left pending.',
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReviewSignatureDto)
  signatures!: ReviewSignatureDto[];
}
