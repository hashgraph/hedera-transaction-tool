import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  Repository,
} from 'typeorm';

import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  attachKeys,
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  ErrorCodes,
  TransactionSignatureService,
  NatsPublisherService,
  userKeysRequiredToSign,
  verifyTransactionBodyWithoutNodeAccountIdSignature,
} from '@app/common';
import {
  Transaction,
  TransactionApprover,
  TransactionStatus,
  User,
} from '@entities';

import {
  ApproverChoiceDto,
  CreateTransactionApproverDto,
  CreateTransactionApproversArrayDto,
  UpdateTransactionApproverDto,
} from '../dto';

@Injectable()
export class ApproversService {
  private readonly CANNOT_CREATE_EMPTY_APPROVER = 'Cannot create empty approver';
  private readonly PARENT_APPROVER_NOT_FOUND = 'Parent approver not found';
  private readonly THRESHOLD_REQUIRED = 'Threshold must be set for the parent approver';
  private readonly CHILDREN_REQUIRED = 'Children must be set when there is a threshold';
  private readonly THRESHOLD_LESS_OR_EQUAL_APPROVERS = (total: number) =>
    `Threshold must be less or equal to the number of approvers (${total}) and not 0`;
  private readonly USER_NOT_FOUND = (id: number) => `User with id: ${id} not found`;
  private readonly APPROVER_ALREADY_EXISTS = 'Approver already exists';
  private readonly ONLY_USER_OR_TREE = 'You can only set a user or a tree of approvers, not both';
  private readonly ROOT_TRANSACTION_NOT_SAME = 'Root transaction is not the same';
  private readonly INVALID_UPDATE_APPROVER =
    'Only one property of the approver can be update user id, list id, or the threshold';
  private readonly APPROVER_NOT_TREE = 'Cannot update threshold, the approver is not a tree';
  private readonly APPROVER_IS_TREE = 'Cannot update user id, the approver is a tree';
  private readonly CANNOT_SET_CHILD_AS_PARENT = 'Cannot set a child as a parent';

  constructor(
    @InjectRepository(TransactionApprover)
    private repo: Repository<TransactionApprover>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly transactionSignatureService: TransactionSignatureService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  /* Get the approver by id */
  getTransactionApproverById(
    id: number,
    entityManager?: EntityManager,
  ): Promise<TransactionApprover> {
    if (!id) return null;

    const find: FindOneOptions<TransactionApprover> = {
      relations: ['approvers'],
      where: { id },
    };

    if (entityManager) {
      return entityManager.findOne(TransactionApprover, find);
    }

    return this.repo.findOne(find);
  }

  /* Get the full list of approvers by transactionId. This will return an array of approvers that may be trees */
  async getApproversByTransactionId(
    transactionId: number,
    userId?: number,
    entityManager?: EntityManager,
  ): Promise<TransactionApprover[]> {
    if (typeof transactionId !== 'number' || (userId && typeof userId !== 'number')) return null;

    return (entityManager || this.repo).query(
      `
      with recursive approverList as
        (
          select * from transaction_approver 
          where "transactionId" = $1
            union all
              select approver.* from transaction_approver as approver
              join approverList on approverList."id" = approver."listId"
        )
      select * from approverList
      where approverList."deletedAt" is null
        ${userId ? 'and approverList."userId" = $2' : ''}
      `,
      userId ? [transactionId, userId] : [transactionId],
    );
  }

  /* Get the full list of approvers by transactionId if user has access */
  async getVerifiedApproversByTransactionId(
    transactionId: number,
    user: User,
  ): Promise<TransactionApprover[]> {
    const transaction = await this.dataSource.manager.findOne(Transaction, {
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user', 'observers', 'signers', 'signers.userKey'],
    });

    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    const approvers = await this.getApproversByTransactionId(transactionId);

    const userKeysToSign = await userKeysRequiredToSign(
      transaction,
      user,
      this.transactionSignatureService,
      this.dataSource.manager,
    );

    if (
      [
        TransactionStatus.EXECUTED,
        TransactionStatus.EXPIRED,
        TransactionStatus.FAILED,
        TransactionStatus.CANCELED,
        TransactionStatus.ARCHIVED,
      ].includes(transaction.status)
    )
      return approvers;

    if (
      userKeysToSign.length === 0 &&
      transaction.creatorKey?.userId !== user.id &&
      !transaction.observers.some(o => o.userId === user.id) &&
      !transaction.signers.some(s => s.userKey?.userId === user.id) &&
      !approvers.some(a => a.userId === user.id)
    )
      throw new UnauthorizedException("You don't have permission to view this transaction");

    return approvers;
  }

  /* Get the full list of approvers by approver id. This will return an array of approvers that may be trees */
  async getTransactionApproversById(
    id: number,
    entityManager?: EntityManager,
  ): Promise<TransactionApprover[]> {
    if (typeof id !== 'number') throw new BadRequestException(ErrorCodes.TNF);

    return (entityManager || this.repo).query(
      `
      with recursive approverList as
        (
          select * from transaction_approver 
          where "id" = $1
            union all
              select approver.* from transaction_approver as approver
              join approverList on approverList."id" = approver."listId"
        )
      select * from approverList
      where approverList."deletedAt" is null
      `,
      [id],
    );
  }

  /* Get root node from a node id */
  async getRootNodeFromNode(
    id: number,
    entityManager?: EntityManager,
  ): Promise<TransactionApprover | null> {
    if (!id || typeof id !== 'number') return null;

    return (
      await (entityManager || this.repo).query(
        `
        with recursive approverList as
          (
            select * from transaction_approver 
            where "id" = $1
              union all 
                select approver.* from transaction_approver as approver
                join approverList on approverList."listId" = approver."id"
          )
        select * from approverList
        where "listId" is null
        `,
        [id],
      )
    )[0];
  }

  /* Soft deletes approvers' tree */
  async removeNode(listId: number): Promise<void> {
    if (!listId || typeof listId !== 'number') return null;

    await this.repo.query(
      `
      with recursive approversToDelete AS
        (
          select "id", "listId", "deletedAt"
          from transaction_approver
          where "id" = $1
  
            union all
              select transaction_approver."id", transaction_approver."listId", transaction_approver."deletedAt"
              from transaction_approver, approversToDelete     
              where approversToDelete."id" = transaction_approver."listId"
      
        )
      update transaction_approver
      set "deletedAt" = now()
      from approversToDelete
      where approversToDelete."id" = transaction_approver."listId" or transaction_approver."id" = $1;
    `,
      [listId],
    );

    // notifyTransactionAction(this.notificationsService);
  }

  /* Create transaction approvers for the given transaction id with the user ids */
  async createTransactionApprovers(
    user: User,
    transactionId: number,
    dto: CreateTransactionApproversArrayDto,
  ): Promise<TransactionApprover[]> {
    await this.getCreatorsTransaction(transactionId, user);

    const approvers: TransactionApprover[] = [];

    try {
      await this.dataSource.transaction(async transactionalEntityManager => {
        const createApprover = async (dtoApprover: CreateTransactionApproverDto) => {
          /* Validate Approver's DTO */
          this.validateApprover(dtoApprover);

          /* Check if the approver already exists */
          if (await this.isNode(dtoApprover, transactionId, transactionalEntityManager))
            throw new Error(this.APPROVER_ALREADY_EXISTS);

          /* Check if the parent approver exists and has threshold */
          if (typeof dtoApprover.listId === 'number') {
            const parent = await transactionalEntityManager.findOne(TransactionApprover, {
              where: { id: dtoApprover.listId },
            });

            if (!parent) throw new Error(this.PARENT_APPROVER_NOT_FOUND);

            /* Check if the root transaction is the same */
            const root = await this.getRootNodeFromNode(
              dtoApprover.listId,
              transactionalEntityManager,
            );
            if (root?.transactionId !== transactionId)
              throw new Error(this.ROOT_TRANSACTION_NOT_SAME);
          }

          /* Check if the user exists */
          if (typeof dtoApprover.userId === 'number') {
            const userCount = await transactionalEntityManager.count(User, {
              where: { id: dtoApprover.userId },
            });

            if (userCount === 0) throw new Error(this.USER_NOT_FOUND(dtoApprover.userId));
          }

          /* Check if there are sub approvers */
          if (
            typeof dtoApprover.userId === 'number' &&
            dtoApprover.approvers &&
            dtoApprover.approvers.length > 0
          )
            throw new Error(this.ONLY_USER_OR_TREE);

          /* Check if the approver has threshold when there are children */
          if (
            dtoApprover.approvers &&
            dtoApprover.approvers.length > 0 &&
            (dtoApprover.threshold === null || isNaN(dtoApprover.threshold))
          )
            throw new Error(this.THRESHOLD_REQUIRED);

          /* Check if the approver has children when there is threshold */
          if (
            typeof dtoApprover.threshold === 'number' &&
            (!dtoApprover.approvers || dtoApprover.approvers.length === 0)
          )
            throw new Error(this.CHILDREN_REQUIRED);

          /* Check if the approver threshold is less or equal to the number of approvers */
          if (
            dtoApprover.approvers &&
            (dtoApprover.threshold > dtoApprover.approvers.length || dtoApprover.threshold === 0)
          )
            throw new Error(this.THRESHOLD_LESS_OR_EQUAL_APPROVERS(dtoApprover.approvers.length));

          const data: DeepPartial<TransactionApprover> = {
            transactionId:
              dtoApprover.listId === null || isNaN(dtoApprover.listId) ? transactionId : null,
            listId: dtoApprover.listId,
            threshold:
              dtoApprover.threshold && dtoApprover.approvers ? dtoApprover.threshold : null,
            userId: dtoApprover.userId,
          };

          if (typeof dtoApprover.userId === 'number') {
            const userApproverRecords = await this.getApproversByTransactionId(
              transactionId,
              dtoApprover.userId,
              transactionalEntityManager,
            );

            if (userApproverRecords.length > 0) {
              data.signature = userApproverRecords[0].signature;
              data.userKeyId = userApproverRecords[0].userKeyId;
              data.approved = userApproverRecords[0].approved;
            }
          }

          /* Create approver */
          const approver = transactionalEntityManager.create(TransactionApprover, data);

          /* Insert approver */
          await transactionalEntityManager.insert(TransactionApprover, approver);
          approvers.push(approver);

          /* Continue creating the three */
          if (dtoApprover.approvers) {
            for (const nestedDtoApprover of dtoApprover.approvers) {
              const nestedApprover = { ...nestedDtoApprover, listId: approver.id };

              if (!nestedDtoApprover.approvers || nestedDtoApprover.approvers.length === 0) {
                nestedApprover.threshold = null;
              }

              await createApprover({ ...nestedDtoApprover, listId: approver.id });
            }
          }
        };

        for (const approver of dto.approversArray) {
          await createApprover(approver);
        }
      });

      emitTransactionStatusUpdate(this.notificationsPublisher, [{ entityId: transactionId  }]);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    return approvers;
  }

  /* Updates an approver of a transaction */
  async updateTransactionApprover(
    id: number,
    dto: UpdateTransactionApproverDto,
    transactionId: number,
    user: User,
  ): Promise<TransactionApprover> {
    try {
      let updated = false;

      const approver = await this.dataSource.transaction(async transactionalEntityManager => {
        /* Check if the dto updates only one thing */
        if (Object.keys(dto).length > 1 || Object.keys(dto).length === 0)
          throw new Error(this.INVALID_UPDATE_APPROVER);

        /* Verifies that the approver exists */
        const approver = await this.getTransactionApproverById(id, transactionalEntityManager);
        if (!approver) throw new BadRequestException(ErrorCodes.ANF);

        /* Gets the root approver */
        const rootNode = await this.getRootNodeFromNode(approver.id, transactionalEntityManager);
        if (!rootNode) throw new BadRequestException(ErrorCodes.RANF);

        /* Verifies that the root transaction is the same as the param */
        if (rootNode.transactionId !== transactionId)
          throw new UnauthorizedException(this.ROOT_TRANSACTION_NOT_SAME);

        /* Verifies that the user is the creator of the transaction */
        await this.getCreatorsTransaction(rootNode.transactionId, user, transactionalEntityManager);

        /* Check if the parent approver exists and has threshold */
        if (dto.listId === null || typeof dto.listId === 'number') {
          if (dto.listId === null) {
            /* Return if the approver is already a root */
            if (approver.listId === null) return approver;

            /* Get the parent approver */
            const parent = await transactionalEntityManager.findOne(TransactionApprover, {
              relations: ['approvers'],
              where: { id: approver.listId },
            });

            /* Set the list id to null and set the transaction id */
            await transactionalEntityManager.update(TransactionApprover, approver.id, {
              listId: null,
              transactionId: rootNode.transactionId,
            });
            approver.listId = null;
            approver.transactionId = rootNode.transactionId;
            updated = true;

            if (parent) {
              const newParentApproversLength = parent.approvers.length - 1;

              /* Soft delete the parent if there are no more children */
              if (newParentApproversLength === 0) {
                await transactionalEntityManager.softRemove(TransactionApprover, parent);
              } else if (newParentApproversLength < parent.threshold) {
                /* Update the parent threshold if the current one is more than the children */
                await transactionalEntityManager.update(TransactionApprover, parent.id, {
                  threshold: newParentApproversLength,
                });
              }
            }

            return approver;
          }

          /* Get the new parent */
          const newParent = await transactionalEntityManager.findOne(TransactionApprover, {
            relations: ['approvers'],
            where: { id: dto.listId },
          });

          /* Check if the new parent exists and is tree */
          if (!newParent) throw new Error(this.PARENT_APPROVER_NOT_FOUND);
          if (typeof newParent.threshold !== 'number') throw new Error(this.THRESHOLD_REQUIRED);

          /* Check if the new parent is not a child of the approver */
          const approverList = await this.getTransactionApproversById(
            approver.id,
            transactionalEntityManager,
          );
          if (approverList.some(a => a.id === dto.listId))
            throw new Error(this.CANNOT_SET_CHILD_AS_PARENT);

          /* Check if the parent's root transaction is the same */
          const parentRoot = await this.getRootNodeFromNode(dto.listId, transactionalEntityManager);
          if (parentRoot?.transactionId !== transactionId)
            throw new Error(this.ROOT_TRANSACTION_NOT_SAME);

          /* Update the list id and sets the transaction id to null */
          await transactionalEntityManager.update(TransactionApprover, approver.id, {
            listId: dto.listId,
            transactionId: null,
          });
          approver.listId = dto.listId;
          approver.transactionId = null;
          updated = true;

          return approver;
        } else if (typeof dto.threshold === 'number') {
          /* Check if the approver is a tree */
          if (typeof approver.threshold !== 'number' || typeof approver.userId === 'number')
            throw new Error(this.APPROVER_NOT_TREE);

          /* Check if the approver threshold is less or equal to the number of approvers */
          if (
            approver.approvers &&
            (dto.threshold > approver.approvers.length || dto.threshold === 0)
          )
            throw new Error(this.THRESHOLD_LESS_OR_EQUAL_APPROVERS(approver.approvers.length));

          /* Update the threshold */
          if (approver.threshold !== dto.threshold) {
            await transactionalEntityManager.update(TransactionApprover, approver.id, {
              threshold: dto.threshold,
            });
            approver.threshold = dto.threshold;
            updated = true;

            return approver;
          }
        } else if (typeof dto.userId === 'number') {
          /* Check if the approver is a tree */
          if (typeof approver.threshold === 'number') throw new Error(this.APPROVER_IS_TREE);

          /* Check if the user exists */
          const userCount = await transactionalEntityManager.count(User, {
            where: { id: dto.userId },
          });
          if (userCount === 0) throw new Error(this.USER_NOT_FOUND(dto.userId));

          /* Update the user */
          if (approver.userId !== dto.userId) {
            const data: DeepPartial<TransactionApprover> = {
              userId: dto.userId,
              userKeyId: undefined,
              signature: undefined,
              approved: undefined,
            };

            approver.userKeyId = undefined;
            approver.signature = undefined;
            approver.approved = undefined;

            await transactionalEntityManager.update(TransactionApprover, approver.id, data);
            approver.userId = dto.userId;
            updated = true;

            return approver;
          }
        }

        return approver;
      });

      if (updated) {
        emitTransactionUpdate(this.notificationsPublisher, [{ entityId: transactionId }]);
      }

      return approver;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /* Removes the transaction approver by id */
  async removeTransactionApprover(id: number): Promise<void> {
    const approver = await this.getTransactionApproverById(id);

    if (!approver) throw new BadRequestException(ErrorCodes.ANF);

    const result = await this.removeNode(approver.id);

    emitTransactionStatusUpdate(this.notificationsPublisher, [{ entityId: approver.transactionId }]);

    return result;
  }

  /* Approves a transaction */
  async approveTransaction(
    dto: ApproverChoiceDto,
    transactionId: number,
    user: User,
  ): Promise<boolean> {
    /* Get all the approvers */
    const approvers = await this.getVerifiedApproversByTransactionId(transactionId, user);

    /* If user is approver, filter the records that belongs to the user */
    const userApprovers = approvers.filter(a => a.userId === user.id);

    /* Check if the user is an approver */
    if (userApprovers.length === 0)
      throw new UnauthorizedException('You are not an approver of this transaction');

    /* Check if the user has already approved the transaction */
    if (userApprovers.every(a => a.signature)) throw new BadRequestException(ErrorCodes.TAP);

    /* Ensures the user keys are passed */
    await attachKeys(user, this.dataSource.manager);
    if (user.keys.length === 0) return false;

    const signatureKey = user.keys.find(key => key.id === dto.userKeyId);

    /* Gets the public key that the signature belongs to */
    const publicKey = PublicKey.fromString(signatureKey?.publicKey);

    /* Get the transaction body */
    const transaction = await this.dataSource.manager.findOne(Transaction, {
      where: { id: transactionId },
      relations: { creatorKey: true, observers: true },
    });

    /* Check if the transaction exists */
    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    /* Checks if the transaction is requires approval */
    if (
      transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
      transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
    )
      throw new BadRequestException(ErrorCodes.TNRA);

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    /* Verify the signature matches the transaction */
    if (
      !verifyTransactionBodyWithoutNodeAccountIdSignature(sdkTransaction, dto.signature, publicKey)
    )
      throw new BadRequestException(ErrorCodes.SNMP);

    /* Update the approver with the signature */
    await this.dataSource.transaction(async transactionalEntityManager => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(TransactionApprover)
        .set({
          userKeyId: dto.userKeyId,
          signature: dto.signature,
          approved: dto.approved,
        })
        .whereInIds(userApprovers.map(a => a.id))
        .execute();
    });

    const notificationEvent = [{ entityId: transaction.id }];

    if (!dto.approved || userApprovers.every(a => a.approved)) {
      emitTransactionStatusUpdate(this.notificationsPublisher, notificationEvent);
    } else {
      emitTransactionUpdate(this.notificationsPublisher, notificationEvent);
    }

    return true;
  }

  /* Get the transaction by id and verifies that the user is the creator */
  async getCreatorsTransaction(
    transactionId: number,
    user: User,
    entityManager?: EntityManager,
  ): Promise<Transaction> {
    const find: FindOneOptions<Transaction> = {
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user'],
    };

    const transaction = await (entityManager
      ? entityManager.findOne(Transaction, find)
      : this.dataSource.manager.findOne(Transaction, find));

    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    if (transaction.creatorKey?.userId !== user.id)
      throw new UnauthorizedException('Only the creator of the transaction is able to modify it');

    return transaction;
  }

  /* Check if the approver node already exists */
  async isNode(
    approver: CreateTransactionApproverDto,
    transactionId: number,
    entityManager?: EntityManager,
  ) {
    const find: FindManyOptions<TransactionApprover> = {
      where: {
        listId: typeof approver.listId === 'number' ? approver.listId : null,
        userId: typeof approver.userId === 'number' ? approver.userId : null,
        threshold:
          typeof approver.threshold === 'number' && approver.threshold !== 0
            ? approver.threshold
            : null,
        transactionId: typeof approver.listId === 'number' ? null : transactionId,
      },
    };

    const count = await (entityManager || this.repo).count(TransactionApprover, find);
    return count > 0 && typeof approver.userId === 'number';
  }

  /* Get the tree structure of the approvers */
  getTreeStructure(approvers: TransactionApprover[]): TransactionApprover[] {
    const approverMap = new Map(approvers.map(approver => [approver.id, { ...approver }]));

    approverMap.forEach(approver => {
      if (approver.listId) {
        const parentApprover = approverMap.get(approver.listId);
        if (parentApprover) {
          if (!parentApprover.approvers) {
            parentApprover.approvers = [];
          }
          parentApprover.approvers.push(approver);
        }
      }
    });

    const rootApprovers = Array.from(approverMap.values()).filter(
      approver => approver.listId === null,
    );

    return rootApprovers;
  }

  /* Validates the approver DTO */
  private validateApprover(approver: CreateTransactionApproverDto): void {
    if (
      (approver.listId === null || isNaN(approver.listId)) &&
      (approver.threshold === null || isNaN(approver.threshold) || approver.threshold === 0) &&
      (approver.userId === null || isNaN(approver.userId)) &&
      (!approver.approvers || approver.approvers.length === 0)
    )
      throw new BadRequestException(this.CANNOT_CREATE_EMPTY_APPROVER);
  }
}
