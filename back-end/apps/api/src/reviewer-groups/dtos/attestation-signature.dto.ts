import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class AttestationSignatureDto {
  @IsInt()
  @Min(1)
  userKeyId: number;

  @IsIn(['approve', 'reject'])
  vote: 'approve' | 'reject';

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  signature: string;
}
