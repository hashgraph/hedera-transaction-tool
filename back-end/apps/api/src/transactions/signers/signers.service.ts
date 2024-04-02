import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionSigner, User } from '@entities/';
import { Repository } from 'typeorm';
import { UploadSignatureDto } from '../dto/upload-signature.dto';

@Injectable()
export class SignersService {
  constructor(
    @InjectRepository(TransactionSigner)
    private repo: Repository<TransactionSigner>,
  ) {}

  // Get the signature for the given signature id.
  //TODO How/When would this get used?
  getSignatureById(id: number): Promise<TransactionSigner> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  //TODO How/When would this get used?
  getSignaturesByUser(user: User): Promise<TransactionSigner[]> {
    if (!user) {
      return null;
    }
    return this.repo
      .createQueryBuilder('signer')
      .leftJoinAndSelect('signer.transaction', 'transaction')
      .leftJoinAndSelect('signer.userKey', 'userKey')
      .where('userKey.user = :user', { user })
      .getMany();
  }

  // Get all signatures for the given transactionId.
  getSignaturesByTransactionId(
    transactionId: number,
  ): Promise<TransactionSigner[]> {
    if (!transactionId) {
      return null;
    }
    return this.repo
      .createQueryBuilder('signer')
      .leftJoinAndSelect('signer.transaction', 'transaction')
      .leftJoinAndSelect('signer.userKey', 'userKey')
      .where('transaction.id = :transactionId', { transactionId })
      .getMany();
  }

  // Upload a signature for the given transaction id.
  async uploadSignature(
    transactionId: number,
    dto: UploadSignatureDto,
  ): Promise<TransactionSigner> {
    // find the value of sign here, has it been transformed?
    const signer = this.repo.create(dto);
    signer['transaction' as any] = transactionId;
    signer['userKey' as any] = dto.userKeyId;
    return this.repo.save(signer);
  }

  // Remove the signature for the given id.
  async removeSignature(id: number): Promise<TransactionSigner> {
    const signer = await this.getSignatureById(id);
    return this.repo.remove(signer);
  }
}
