import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';
import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  CHAIN_SERVICE,
  emitUpdateTransactionStatus,
  isExpired,
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
        userId: user.id,
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

  /* Upload signatures for the given transaction ids */
  async uploadSignatureMaps(
    dto: UploadSignatureMapDto[],
    user: User,
  ): Promise<TransactionSigner[]> {
    const signers = new Set<TransactionSigner>();
    for (const { transactionId, signatureMap: map } of dto) {
      /* Verify that the transaction exists */
      const transaction = await this.dataSource.manager.findOneBy(Transaction, {id: transactionId});
      if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

      /* Checks if the transaction is canceled */
      if (
        transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
        transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
      )
        throw new BadRequestException(ErrorCodes.TNRS);

      /* Checks if the transaction is expired */
      let sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
      if (isExpired(sdkTransaction)) throw new BadRequestException(ErrorCodes.TE);

      /* Validates the signatures */
      const {data: publicKeys, error} = safe<PublicKey[]>(
        validateSignature.bind(this, sdkTransaction, map),
      );
      if (error) throw new BadRequestException(ErrorCodes.ISNMPN);

      const userKeys: UserKey[] = [];
      for (const publicKey of publicKeys) {
        const userKey = user.keys.find(key => key.publicKey === publicKey.toStringRaw());
        if (!userKey) throw new BadRequestException(ErrorCodes.PNY);

        sdkTransaction = sdkTransaction.addSignature(publicKey, map);
        userKeys.push(userKey);
      }

      /* Start a database transaction */
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await this.dataSource.manager.update(
          Transaction,
          {id: transactionId},
          {
            transactionBytes: sdkTransaction.toBytes(),
          },
        );

        for (const userKey of userKeys) {
          const signer = this.repo.create({
            user,
            transaction,
            userKey,
          });
          await queryRunner.manager.insert(TransactionSigner, signer);
          signers.add(signer);
        }
        /* Commit the database transaction */
        await queryRunner.commitTransaction();
        await queryRunner.release();
      } catch {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new BadRequestException(ErrorCodes.FST);
      }

      emitUpdateTransactionStatus(this.chainService, transactionId);
      notifyTransactionAction(this.notificationService);
      notifySyncIndicators(this.notificationService, transactionId, transaction.status, {
        transactionId: transaction.transactionId,
        network: transaction.mirrorNetwork,
      });
    }
    return [...signers];
  }
}
