import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VersionCheckResponseDto {
  @ApiProperty({
    description: 'The latest supported frontend version (from server configuration)',
    example: '1.2.0',
  })
  @Expose()
  latestSupportedVersion: string;

  @ApiProperty({
    description: 'The minimum supported frontend version (from server configuration)',
    example: '1.0.0',
  })
  @Expose()
  minimumSupportedVersion: string;

  @ApiProperty({
    description: 'URL to the releases page where the user can download updates. Null if no update is available.',
    example: 'https://github.com/hashgraph/hedera-transaction-tool/releases/tag/v1.2.0',
    nullable: true,
  })
  @Expose()
  updateUrl: string | null;
}
