import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VersionCheckResponseDto {
  @ApiProperty({
    description: 'Indicates if the version check was successful',
    example: true,
  })
  @Expose()
  success: boolean;
}
