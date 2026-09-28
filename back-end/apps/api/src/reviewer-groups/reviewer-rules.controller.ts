import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { User } from '@entities';
import { Serialize } from '@app/common';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { GetUser } from '../decorators';

import { CreateReviewerRuleDto, DeleteReviewerRuleDto, ReviewerRuleDto, RuleChangeRecordDto } from './dtos';
import { ReviewerRulesService } from './reviewer-rules.service';

@ApiTags('Reviewer Rules')
@Controller('reviewer-groups/rules')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class ReviewerRulesController {
  constructor(private readonly service: ReviewerRulesService) {}

  @ApiOperation({ summary: 'List all reviewer rules' })
  @ApiResponse({ status: 200, type: [ReviewerRuleDto] })
  @Get()
  @Serialize(ReviewerRuleDto)
  getRules() {
    return this.service.getRules();
  }

  @ApiOperation({ summary: 'Get change record history for a reviewer rule' })
  @ApiResponse({ status: 200, type: [RuleChangeRecordDto] })
  @Get(':id/changes')
  @Serialize(RuleChangeRecordDto)
  getRuleChanges(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRuleChanges(id);
  }

  @ApiOperation({ summary: 'Get a single reviewer rule' })
  @ApiResponse({ status: 200, type: ReviewerRuleDto })
  @Get(':id')
  @Serialize(ReviewerRuleDto)
  getRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRule(id);
  }

  @ApiOperation({ summary: 'Create a reviewer rule' })
  @ApiResponse({ status: 201, type: ReviewerRuleDto })
  @UseGuards(AdminGuard)
  @Post()
  @Serialize(ReviewerRuleDto)
  createRule(@Body() dto: CreateReviewerRuleDto, @GetUser() user: User) {
    return this.service.createRule(dto, user.id);
  }

  @ApiOperation({ summary: 'Request rule deletion; returns the pending change record members must sign' })
  @ApiResponse({ status: 202, type: RuleChangeRecordDto })
  @UseGuards(AdminGuard)
  @Post(':id/delete')
  @HttpCode(HttpStatus.ACCEPTED)
  @Serialize(RuleChangeRecordDto)
  deleteRule(@Param('id', ParseIntPipe) id: number, @Body() dto: DeleteReviewerRuleDto, @GetUser() user: User) {
    return this.service.deleteRule(id, dto, user.id);
  }
}
