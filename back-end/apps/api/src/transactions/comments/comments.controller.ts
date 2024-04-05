import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '@entities';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transaction Comments')
@Controller('transactions/:transactionId?/comments')
@UseGuards(JwtAuthGuard)
//TODO add serializer
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  //TODO need some sort of guard or check to ensure user can comment here
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
  getCommentById(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.getTransactionCommentById(id);
  }

  //TODO add update and remove routes
}
