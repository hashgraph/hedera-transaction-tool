import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { User } from '@entities';
import { Serialize } from '@app/common';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { GetUser } from '../decorators';

import {
  CreateReviewerGroupDto,
  DeleteReviewerGroupDto,
  GroupChangeRecordDto,
  ReviewerGroupDetailDto,
  ReviewerGroupSummaryDto,
  UpdateReviewerGroupDto,
} from './dtos';
import { ReviewerGroupsService } from './reviewer-groups.service';

@ApiTags('Reviewer Groups')
@Controller('reviewer-groups')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class ReviewerGroupsController {
  constructor(private readonly service: ReviewerGroupsService) {}

  @ApiOperation({ summary: 'List all reviewer groups' })
  @ApiResponse({ status: 200, type: [ReviewerGroupSummaryDto] })
  @Get()
  @Serialize(ReviewerGroupSummaryDto)
  getGroups() {
    return this.service.getGroups();
  }

  @ApiOperation({ summary: 'Get change record history for a reviewer group' })
  @ApiResponse({ status: 200, type: [GroupChangeRecordDto] })
  @Get(':id/changes')
  @Serialize(GroupChangeRecordDto)
  getGroupChanges(
    @Param('id', ParseIntPipe) id: number,
    @Query('fromVersion', new ParseIntPipe({ optional: true })) fromVersion?: number,
  ) {
    return this.service.getGroupChanges(id, fromVersion);
  }

  @ApiOperation({ summary: 'Get a single reviewer group with members and rules' })
  @ApiResponse({ status: 200, type: ReviewerGroupDetailDto })
  @Get(':id')
  @Serialize(ReviewerGroupDetailDto)
  getGroup(@Param('id', ParseIntPipe) id: number) {
    return this.service.getGroup(id);
  }

  @ApiOperation({ summary: 'Create a reviewer group' })
  @ApiResponse({ status: 201, type: ReviewerGroupDetailDto })
  @UseGuards(AdminGuard)
  @Post()
  @Serialize(ReviewerGroupDetailDto)
  createGroup(@Body() dto: CreateReviewerGroupDto, @GetUser() user: User) {
    return this.service.createGroup(dto, user.id);
  }

  @ApiOperation({ summary: 'Request a group update; returns the pending change record members must sign' })
  @ApiResponse({ status: 202, type: GroupChangeRecordDto })
  @UseGuards(AdminGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  @Serialize(GroupChangeRecordDto)
  updateGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewerGroupDto,
    @GetUser() user: User,
  ) {
    return this.service.updateGroup(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Request group deletion; returns the pending change record members must sign' })
  @ApiResponse({ status: 202, type: GroupChangeRecordDto })
  @UseGuards(AdminGuard)
  @Post(':id/delete')
  @HttpCode(HttpStatus.ACCEPTED)
  @Serialize(GroupChangeRecordDto)
  deleteGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteReviewerGroupDto,
    @GetUser() user: User,
  ) {
    return this.service.deleteGroup(id, dto, user.id);
  }
}
