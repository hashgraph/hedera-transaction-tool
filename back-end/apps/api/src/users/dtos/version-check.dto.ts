import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VersionCheckDto {
  @ApiProperty({
    description: 'Frontend application version in semver format',
    example: '1.2.3',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/, {
    message: 'Version must be in semver format (e.g., 1.2.3, 1.2.3-beta.1)',
  })
  version: string;
}
