import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';

import { SigningReportItemDto, SigningReportQueryDto } from './dto/signing-report.dto';
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
      'or user, filtered by date range. Admin only.',
  })
  @ApiResponse({ status: 200, type: [SigningReportItemDto] })
  @Get()
  getSigningReport(@Query() query: SigningReportQueryDto): Promise<SigningReportItemDto[]> {
    return this.service.getSigningReport(query);
  }
}
