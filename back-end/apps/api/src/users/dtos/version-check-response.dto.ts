import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VersionCheckResponseDto {
  @ApiProperty({
    description: 'Indicates if the version check was successful',
    example: true,
  })
  @Expose()
  success: boolean;

  @ApiProperty({
    description: 'The latest supported frontend version (from server configuration)',
    example: '1.2.0',
    nullable: true,
  })
  @Expose()
  latestSupportedVersion: string | null;

  @ApiProperty({
    description: 'The minimum supported frontend version (from server configuration)',
    example: '1.0.0',
    nullable: true,
  })
  @Expose()
  minimumSupportedVersion: string | null;

  @ApiProperty({
    description: 'URL to the releases page where the user can download updates',
    example: 'https://github.com/hashgraph/hedera-transaction-tool/releases/tag/v1.2.0',
    nullable: true,
  })
  @Expose()
  updateUrl: string | null;

  @ApiProperty({
    description: 'True if the user version is older than the latest supported version',
    example: true,
  })
  @Expose()
  updateAvailable: boolean;

  @ApiProperty({
    description: 'True if the user version is below the minimum supported version',
    example: false,
  })
  @Expose()
  belowMinimumVersion: boolean;
}
