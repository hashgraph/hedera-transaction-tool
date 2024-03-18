import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionApprover } from '../../entities/transaction-approver.entity';
import { Repository } from 'typeorm';
import { CreateTransactionApproverDto } from '../dto/create-transaction-approver.dto';

@Injectable()
export class ApproversService {
  constructor(
    @InjectRepository(TransactionApprover)
    private repo: Repository<TransactionApprover>,
  ) {}

  getTransactionApproverById(id: number): Promise<TransactionApprover> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      relations: ['transaction', 'userKey'],
      where: { id },
    });
  }

  //TODO not sure if this is used, same with approvers, might want to put both of these back into transaction?
  // becuase the purpose is to return the list of transactions that the user is a part of, not the transactionapprover
  getTransactionApproversByUserId(
    userId: number,
  ): Promise<TransactionApprover[]> {
    if (!userId) {
      return null;
    }
    return this.repo
      .createQueryBuilder('approver')
      .leftJoinAndSelect('approver.transaction', 'transaction')
      .leftJoinAndSelect('approver.userKey', 'userKey')
      .where('userKey.userId = :userId', { userId })
      .getMany();
  }

  //TODO this should probably return the full approver tree/list/thing, not a list of transaction approvers
  getTransactionApproversByTransactionId(
    transactionId: number,
  ): Promise<TransactionApprover[]> {
    if (!transactionId) {
      return null;
    }
    return this.repo
      .createQueryBuilder('approver')
      .leftJoinAndSelect('approver.transaction', 'transaction')
      .where('transaction.id = :transactionId', { transactionId })
      .getMany();
  }

  //TODO this should ensure that the approver row fits someone (root row, or belongs to a list or whatever)
  async createTransactionApprover(
    transactionId: number,
    dto: CreateTransactionApproverDto,
  ): Promise<TransactionApprover> {
    const approver = await this.repo.create(dto);
    approver['transaction' as any] = transactionId;
    return this.repo.save(approver);
  }

  async removeTransactionApprover(id: number): Promise<TransactionApprover> {
    const approver = await this.getTransactionApproverById(id);
    if (!approver) {
      throw new NotFoundException();
    }
    return this.repo.remove(approver);
  }
}
