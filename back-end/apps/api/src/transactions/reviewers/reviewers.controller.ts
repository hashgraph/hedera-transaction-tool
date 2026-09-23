import { Body, Controller, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { GetUser } from '../../decorators';

import { ReviewActionDto } from '../dto';
import { ReviewersService } from './reviewers.service';

@ApiTags('Transaction Reviewers')
@Controller('transactions/:transactionId/review')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class ReviewersController {
  constructor(private readonly reviewersService: ReviewersService) {}

  @ApiOperation({
    summary: 'Submit a review action',
    description:
      'Accept or reject a transaction under review. One action satisfies all pending reviewer list memberships for the calling user.',
  })
  @ApiResponse({ status: 204 })
  @Post()
  @HttpCode(204)
  async submitReview(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: ReviewActionDto,
    @GetUser() user: User,
  ): Promise<void> {
    return this.reviewersService.submitReview(transactionId, body, user);
  }
}
