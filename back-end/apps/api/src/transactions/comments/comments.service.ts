import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionComment } from '@entities/transaction-comment.entity';
import { Repository } from 'typeorm';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { User } from '@entities/user.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(TransactionComment)
    private repo: Repository<TransactionComment>,
  ) {}

  // Create a transaction comment for the given transaction with the provided data.
  async createComment(
    user: User,
    transactionId: number,
    dto: CreateCommentDto,
  ): Promise<TransactionComment> {
    const comment = this.repo.create(dto);
    comment['transaction' as any] = transactionId;
    comment.user = user;
    return this.repo.save(comment);
  }

  // Get the transaction comment for the given id.
  getTransactionCommentById(id: number) {
    return this.repo.findOneBy({ id });
  }

  // Get the transaction comments for the given transaction id.
  getTransactionComments(transactionId: number) {
    return this.repo
      .createQueryBuilder('comment')
      .where('comment.transactionId = :transactionId', { transactionId })
      .getMany();
  }
}
