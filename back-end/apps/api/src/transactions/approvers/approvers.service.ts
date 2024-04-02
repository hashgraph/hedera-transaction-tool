import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionApprover } from '@entities/';
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
  // because the purpose is to return the list of transactions that the user is a part of, not the transactionapprover
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

  // Get the full list of approvers by transactionId. This will return one approver, a list of approvers, or
  // a complex list (tree) of approvers.
  //TODO should this list be sorted such that each node has it's children listed first before the next node? Like a tree.
  getTransactionApproversByTransactionId(
    transactionId: number,
  ): Promise<TransactionApprover[]> {
    if (!transactionId) {
      return null;
    }
    return this.repo
      .query(`with recursive approverList as ` +
        `(select * from transaction_approver where transactionId = ${transactionId} ` +
        `union all ` +
        `select approver.* from transaction_approver as approver ` +
          `join approverList on approverList.id = approver.listId) ` +
        `select * from approverList`);
  }

  //TODO this should ensure that the approver row fits someone (root row, or belongs to a list or whatever)
  async createTransactionApprover(dto: CreateTransactionApproverDto): Promise<TransactionApprover> {
    const approver = this.repo.create(dto);
    approver['user' as any] = dto.userKeyId;
    approver['list' as any] = dto.listId;
    approver['transaction' as any] = dto.transactionId;
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
