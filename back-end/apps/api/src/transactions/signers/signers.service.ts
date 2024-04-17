import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';
import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { TransactionSigner, TransactionStatus, User } from '@entities';

import { TransactionsService } from '../transactions.service';

import { UploadSignatureDto } from '../dto/upload-signature.dto';
import {
  addTransactionSignatures,
  isAlreadySigned,
  isExpired,
  validateSignature,
} from '@app/common';

@Injectable()
export class SignersService {
  constructor(
    @InjectRepository(TransactionSigner)
    private repo: Repository<TransactionSigner>,
    private dataSource: DataSource,
    private transactionService: TransactionsService,
  ) {}

  /* Get the signature for the given signature id */
  getSignatureById(id: number): Promise<TransactionSigner> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      where: { id },
    });
  }

  /* Get the signatures that a user has given */
  getSignaturesByUser(
    user: User,
    take: number = 10,
    skip: number = 0,
  ): Promise<TransactionSigner[]> {
    if (!user) return null;

    return this.repo.find({
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
      skip,
      take,
    });
  }

  /* Get the signatures for the given transaction id */
  getSignaturesByTransactionId(transactionId: number): Promise<TransactionSigner[]> {
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
    const transaction = await this.transactionService.getTransactionById(transactionId);
    if (!transaction) throw new BadRequestException('Transaction not found');
    if (transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES)
      throw new BadRequestException('Transaction is not waiting for signatures');

    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);
    if (isExpired(sdkTransaction)) throw new BadRequestException('Transaction is expired');

    /* Verify that each signature corresponds the correct transaction for the given node and to the public key  */
    for (const key in signatures) {
      if (!validateSignature(sdkTransaction, key, signatures[key], userKey.publicKey)) {
        throw new BadRequestException(`Invalid Signature for Node with Account ID: ${key}`);
      }
    }

    /* Add the signatures to the transaction */
    if (isAlreadySigned(sdkTransaction, userKey.publicKey))
      throw new BadRequestException('Signature already added');

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
      await this.transactionService.updateTransaction(transaction, {
        body: sdkTransaction.toBytes(),
      });
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

      /* Check if ready to execute */
      // Notify the chain service to check for execution

      return signer;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new BadRequestException('Failed to save transaction');
    }
  }

  // Remove the signature for the given id.
  async removeSignature(id: number): Promise<TransactionSigner> {
    const signer = await this.getSignatureById(id);
    return this.repo.remove(signer);
  }
}
