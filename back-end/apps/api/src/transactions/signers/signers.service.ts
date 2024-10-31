import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';
import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  CHAIN_SERVICE,
  emitUpdateTransactionStatus,
  isExpired,
  MirrorNodeService,
  notifySyncIndicators,
  notifyTransactionAction,
  NOTIFICATIONS_SERVICE,
  PaginatedResourceDto,
  Pagination,
  validateSignature,
  ErrorCodes,
  safe,
} from '@app/common';
import { Transaction, TransactionSigner, TransactionStatus, User, UserKey } from '@entities';

import { UploadSignatureMapDto } from '../dto';

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
  async uploadSignatureMap(
    transactionId: number,
    { signatureMap }: UploadSignatureMapDto,
    user: User,
  ): Promise<TransactionSigner[]> {
    /* Verify that the transaction exists */
    const transaction = await this.dataSource.manager.findOneBy(Transaction, { id: transactionId });
    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    let sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
    if (isExpired(sdkTransaction)) throw new BadRequestException(ErrorCodes.TE);

    /* Checks if the transaction is canceled */
    if (transaction.status === TransactionStatus.CANCELED)
      throw new BadRequestException(ErrorCodes.TC); //TO DO Move in guard

    /* Validates the signatures */
    const { data: publicKeys, error } = await safe<PublicKey[]>(
      validateSignature.bind(this, sdkTransaction, signatureMap),
    );
    if (error) throw new BadRequestException(ErrorCodes.ISNMPN);

    const userKeys: UserKey[] = [];
    for (const publicKey of publicKeys) {
      sdkTransaction = sdkTransaction.addSignature(publicKey, signatureMap);

      const userKey = user.keys.find(key => key.publicKey === publicKey.toStringRaw());
      if (!userKey) throw new BadRequestException(ErrorCodes.PNY);
      userKeys.push(userKey);
    }

    /* Start a database transaction */
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const signers: TransactionSigner[] = [];
    try {
      Object.assign(transaction, {
        transactionBytes: sdkTransaction.toBytes(),
      });
      await this.dataSource.manager.save(Transaction, transaction);

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
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException(ErrorCodes.FST);
    }

    emitUpdateTransactionStatus(this.chainService, transactionId);
    notifyTransactionAction(this.notificationService);
    notifySyncIndicators(this.notificationService, transactionId, transaction.status);

    return signers;
  }
}
