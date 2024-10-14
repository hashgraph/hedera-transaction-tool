import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';
import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  addTransactionSignatures,
  CHAIN_SERVICE,
  emitUpdateTransactionStatus,
  isAlreadySigned,
  isExpired,
  MirrorNodeService,
  notifySyncIndicators,
  notifyTransactionAction,
  NOTIFICATIONS_SERVICE,
  PaginatedResourceDto,
  Pagination,
  userKeysRequiredToSign,
  validateSignature,
} from '@app/common';

import { Transaction, TransactionSigner, TransactionStatus, User, UserKey } from '@entities';

import { UploadSignatureArrayDto, UploadSignatureDto } from '../dto';

@Injectable()
export class SignersService {
  constructor(
    @InjectRepository(TransactionSigner)
    private repo: Repository<TransactionSigner>,
    @InjectDataSource() private dataSource: DataSource,
    @Inject(CHAIN_SERVICE) private readonly chainService: ClientProxy,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationService: ClientProxy,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Get the signature for the given signature id */
  getSignatureById(id: number): Promise<TransactionSigner> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
  }

  /* Get the signatures that a user has given */
  async getSignaturesByUser(
    user: User,
    { limit, offset, page, size }: Pagination,
    withDeleted: boolean = false,
  ): Promise<PaginatedResourceDto<TransactionSigner>> {
    if (!user) return null;

    const [items, totalItems] = await this.repo.findAndCount({
      where: {
        user: {
          id: user.id,
        },
      },
      select: {
        id: true,
        transactionId: true,
        userKeyId: true,
        createdAt: true,
      },
      withDeleted,
      skip: offset,
      take: limit,
    });

    return {
      totalItems,
      items,
      page,
      size,
    };
  }

  /* Get the signatures for the given transaction id */
  getSignaturesByTransactionId(
    transactionId: number,
    withDeleted: boolean = false,
  ): Promise<TransactionSigner[]> {
    if (!transactionId) {
      return null;
    }
    return this.repo.find({
      where: {
        transaction: {
          id: transactionId,
        },
      },
      relations: {
        userKey: true,
      },
      withDeleted,
    });
  }

  /* Upload a signature for the given transaction id */
  async uploadSignature(
    transactionId: number,
    { publicKeyId, signatures }: UploadSignatureDto,
    user: User,
  ): Promise<TransactionSigner> {
    /* Verify that the user has the key */
    const userKey = user.keys.find(key => key.id === publicKeyId);
    if (!userKey) throw new BadRequestException('Transaction can be signed only with your own key');

    /* Verify that the transaction exists */
    const transaction = await this.dataSource.manager.findOneBy(Transaction, { id: transactionId });
    if (!transaction) throw new BadRequestException('Transaction not found');

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
    if (isExpired(sdkTransaction)) throw new BadRequestException('Transaction is expired');

    /* Checks if the transaction is canceled */
    if (transaction.status === TransactionStatus.CANCELED)
      throw new BadRequestException('Transaction has been canceled');

    /* Verify that each signature corresponds the correct transaction for the given node and to the public key  */
    for (const key in signatures) {
      if (!validateSignature(sdkTransaction, key, signatures[key], userKey.publicKey)) {
        throw new BadRequestException(`Invalid Signature for Node with Account ID: ${key}`);
      }
    }

    /* Add the signatures to the transaction */
    if (isAlreadySigned(sdkTransaction, userKey.publicKey))
      throw new BadRequestException('Signature already added');

    const keysIds = await userKeysRequiredToSign(
      transaction,
      user,
      this.mirrorNodeService,
      this.dataSource.manager,
    );

    if (!keysIds.includes(userKey.id)) {
      throw new BadRequestException('This key is not required to sign this transaction');
    }

    try {
      addTransactionSignatures(sdkTransaction, signatures, userKey.publicKey);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    /* Start a database transaction */
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    /* Update the transaction */
    try {
      Object.assign(transaction, {
        transactionBytes: sdkTransaction.toBytes(),
      });
      await this.dataSource.manager.update(Transaction, { id: transactionId }, transaction);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException('Failed to update transaction');
    }

    /* Create transaction signer record */
    try {
      const signer = this.repo.create({
        user,
        transaction,
        userKey,
      });
      await this.repo.save(signer);

      /* Commit the database transaction */
      await queryRunner.commitTransaction();

      emitUpdateTransactionStatus(this.chainService, transactionId);
      notifyTransactionAction(this.notificationService);
      notifySyncIndicators(this.notificationService, transactionId, transaction.status);

      return signer;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException('Failed to save transaction');
    }
  }

  /* Upload a signature for the given transaction id */
  async uploadSignatures(
    transactionId: number,
    { signatures: signaturesArray }: UploadSignatureArrayDto,
    user: User,
  ): Promise<TransactionSigner[]> {
    /* Verify that the transaction exists */
    const transaction = await this.dataSource.manager.findOneBy(Transaction, { id: transactionId });
    if (!transaction) throw new BadRequestException('Transaction not found');

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
    if (isExpired(sdkTransaction)) throw new BadRequestException('Transaction is expired');

    /* Checks if the transaction is canceled */
    if (transaction.status === TransactionStatus.CANCELED)
      throw new BadRequestException('Transaction has been canceled');

    const userKeys: UserKey[] = [];

    for (const { publicKeyId, signatures } of signaturesArray) {
      /* Get the user key */
      const userKey = user.keys.find(key => key.id === publicKeyId);

      /* Verify that the signature is not already added */
      if (isAlreadySigned(sdkTransaction, userKey.publicKey))
        throw new BadRequestException('Signature already added');

      /* Verify that each signature corresponds the correct transaction for the given node and to the public key  */
      for (const nodeAccountId in signatures) {
        if (
          !validateSignature(
            sdkTransaction,
            nodeAccountId,
            signatures[nodeAccountId],
            userKey.publicKey,
          )
        ) {
          throw new BadRequestException(
            `Invalid Signature for Node with Account ID: ${nodeAccountId}`,
          );
        }
      }

      /* Add the signatures to the transaction */
      try {
        addTransactionSignatures(sdkTransaction, signatures, userKey.publicKey);
        userKeys.push(userKey);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    /* Start a database transaction */
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    /* Update the transaction */
    try {
      Object.assign(transaction, {
        transactionBytes: sdkTransaction.toBytes(),
      });
      await this.dataSource.manager.save(Transaction, transaction);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException('Failed to update transaction');
    }

    /* Create transaction signer record */
    try {
      const signers: TransactionSigner[] = [];

      for (const userKey of userKeys) {
        const signer = this.repo.create({
          user,
          transaction,
          userKey,
        });
        await queryRunner.manager.insert(TransactionSigner, signer);
        signers.push(signer);
      }
      /* Commit the database transaction */
      await queryRunner.commitTransaction();
      await queryRunner.release();

      emitUpdateTransactionStatus(this.chainService, transactionId);
      notifyTransactionAction(this.notificationService);
      notifySyncIndicators(this.notificationService, transactionId, transaction.status);

      return signers;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException('Failed to save transaction');
    }
  }

  /* Remove the signature for the given id */
  async removeSignature(id: number): Promise<boolean> {
    await this.repo.softDelete(id);

    return true;
  }
}
