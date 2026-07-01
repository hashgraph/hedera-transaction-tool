import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { TransactionAccessGuard } from '../../guards/transaction-access.guard';

import { GetUser } from '../../decorators';

import { CommentsService } from './comments.service';

import { CreateCommentDto } from '../dto';

@ApiTags('Transaction Comments')
@Controller('transactions/:transactionId/comments')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard, TransactionAccessGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  createComment(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(user, transactionId, dto);
  }

  @Get()
  getComments(@Param('transactionId', ParseIntPipe) transactionId: number) {
    return this.commentsService.getTransactionComments(transactionId);
  }

  @Get('/:id')
  getCommentById(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.commentsService.getTransactionCommentById(transactionId, id);
  }

  //TODO add update and remove routes
}
