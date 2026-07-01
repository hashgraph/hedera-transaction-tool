import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ToBoolean } from '../../decorators';

export enum SigningReportType {
  ACCOUNT = 'account',
  TRANSACTION = 'transaction',
  GROUP = 'group',
  USER = 'user',
}

export enum SigningStatus {
  SIGNED = 'SIGNED',
  NOT_SIGNED = 'NOT_SIGNED',
}

export enum SigningEntityType {
  ACCOUNT = 'ACCOUNT',
  NODE = 'NODE',
}

export enum SigningReportFormat {
  CSV = 'csv',
  JSON = 'json',
}

export class SigningReportQueryDto {
  @ApiProperty({ enum: SigningReportType })
  @IsEnum(SigningReportType)
  type: SigningReportType;

  @ApiProperty({
    description:
      'Hedera account ID (e.g. 0.0.55) for the account type; numeric entity ID for all other types',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    required: false,
    description:
      'Mirror network the report is scoped to (e.g. testnet, mainnet). Required for the account ' +
      'and user types, whose identifiers are network-relative. Ignored for the transaction and ' +
      'group types, which are looked up by (globally unique) database id.',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  mirrorNetwork?: string;

  @ApiProperty({ required: false, description: 'Required for the account and user types' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ required: false, description: 'Defaults to today when omitted' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({
    required: false,
    default: true,
    description:
      'When true (default) only completed (terminal) transactions are reported, using their ' +
      'historical key snapshots. When false, all transactions are included — transactions that ' +
      'are not yet complete have their keys read from the live account/node cache.',
  })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  completedOnly?: boolean = true;

  @ApiProperty({
    enum: SigningReportFormat,
    required: false,
    default: SigningReportFormat.CSV,
    description: 'Response format. Defaults to CSV; pass json for the structured JSON array.',
  })
  @IsEnum(SigningReportFormat)
  @IsOptional()
  format?: SigningReportFormat = SigningReportFormat.CSV;
}

export class SigningReportItemDto {
  @ApiProperty({ description: 'The Hedera transaction ID (e.g. 0.0.1001@1700000000.000000000)' })
  transactionId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  validStart: string;

  @ApiProperty({ nullable: true })
  executedAt: string | null;

  @ApiProperty({ enum: SigningEntityType, description: 'Whether the key belongs to an account or a node' })
  entityType: SigningEntityType;

  @ApiProperty({ description: 'The account ID (e.g. 0.0.55) or node ID the key belongs to' })
  entityId: string;

  @ApiProperty({
    description: 'A public key from the account/node key active when the transaction ran',
  })
  publicKey: string;

  @ApiProperty({ nullable: true, description: 'Null when no UserKey matches the public key' })
  userId: number | null;

  @ApiProperty({ nullable: true, description: 'Null when no UserKey matches the public key' })
  userEmail: string | null;

  @ApiProperty({
    nullable: true,
    description: 'When the key signed the transaction (from the signer record); null if not signed',
  })
  signedAt: string | null;

  @ApiProperty({ enum: SigningStatus })
  signingStatus: SigningStatus;
}
