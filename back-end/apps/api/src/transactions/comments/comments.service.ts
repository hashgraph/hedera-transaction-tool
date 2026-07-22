import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionComment, User } from '@entities';
import { Repository } from 'typeorm';
import { ErrorCodes } from '@app/common';
import { CreateCommentDto } from '../dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

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
    const comment = this.repo.create({
      ...dto,
      transaction: { id: transactionId },
      user,
    });
    try {
      return await this.repo.save(comment);
    } catch (error) {
      this.logger.error('Failed to save transaction comment', (error as any)?.stack ?? (error as any)?.message ?? String(error));
      throw new BadRequestException(ErrorCodes.FSTC);
    }
  }

  // Get the transaction comment for the given id, scoped to the transaction.
  getTransactionCommentById(transactionId: number, id: number) {
    return this.repo.findOne({ where: { id, transaction: { id: transactionId } }, relations: ['user'] });
  }

  // Get the transaction comments for the given transaction id.
  getTransactionComments(transactionId: number) {
    return this.repo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.transactionId = :transactionId', { transactionId })
      .getMany();
  }
}
