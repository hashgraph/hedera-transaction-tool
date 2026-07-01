import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';

import {
  SigningReportFormat,
  SigningReportItemDto,
  SigningReportQueryDto,
} from './dto/signing-report.dto';
import { toCsv } from './signing-report.csv';
import { SigningReportService } from './signing-report.service';

@ApiTags('Reports')
@Controller('reports/signing')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard, AdminGuard)
export class SigningReportController {
  constructor(private readonly service: SigningReportService) {}

  @ApiOperation({
    summary: 'Get signing activity report',
    description:
      'Returns the per-account key signing activity for a given account, transaction, group, ' +
      'or user, filtered by date range. Admin only. Returns CSV by default; pass format=json ' +
      'for the structured JSON array.',
  })
  @ApiExtraModels(SigningReportItemDto)
  @ApiProduces('text/csv', 'application/json')
  @ApiResponse({
    status: 200,
    description: 'Signing activity rows — CSV by default (text/csv), or a JSON array when format=json.',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'transactionId,createdAt,validStart,executedAt,entityType,entityId,publicKey,userId,userEmail,signingStatus',
        },
      },
      'application/json': {
        schema: { type: 'array', items: { $ref: getSchemaPath(SigningReportItemDto) } },
      },
    },
  })
  @Get()
  async getSigningReport(
    @Query() query: SigningReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SigningReportItemDto[] | string> {
    const rows = await this.service.getSigningReport(query);

    if (query.format === SigningReportFormat.JSON) {
      return rows;
    }

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="signing-report.csv"');
    return toCsv(rows);
  }
}
