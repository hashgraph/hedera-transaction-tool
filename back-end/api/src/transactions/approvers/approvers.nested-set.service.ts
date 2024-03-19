import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';
import { CreateTransactionApproverDto } from '../dto/create-transaction-approver.dto';
import { TransactionApproverNestedSet } from '../../entities/transaction-approver.nested-set.entity';

@Injectable()
export class ApproversService {
  constructor(
    @InjectRepository(TransactionApproverNestedSet)
    private repo: TreeRepository<TransactionApproverNestedSet>,
  ) {}

  getTransactionApproverById(
    id: number,
  ): Promise<TransactionApproverNestedSet> {
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
  ): Promise<TransactionApproverNestedSet[]> {
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
  ): Promise<TransactionApproverNestedSet[]> {
    if (!transactionId) {
      return null;
    }
    // return this.repo
    //   .createDescendantsQueryBuilder('approver', '', null)
    //   .where('transaction.id = :transactionId', { transactionId })
    //   .getMany();
    return null;
  }

  //TODO this should ensure that the approver row fits someone (root row, or belongs to a list or whatever)
  async createTransactionApprover(
    transactionId: number,
    dto: CreateTransactionApproverDto,
  ): Promise<TransactionApproverNestedSet> {
    const approver = await this.repo.create(dto);
    approver['transaction' as any] = transactionId;
    return this.repo.save(approver);
  }

  async removeTransactionApprover(
    id: number,
  ): Promise<TransactionApproverNestedSet> {
    const approver = await this.getTransactionApproverById(id);
    if (!approver) {
      throw new NotFoundException();
    }
    return this.repo.remove(approver);
  }
}
