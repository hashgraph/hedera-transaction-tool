import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionSigner } from '../../entities/transaction-signer.entity';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UploadSignatureDto } from '../dto/upload-signature.dto';

@Injectable()
export class SignersService {
  constructor(
    @InjectRepository(TransactionSigner)
    private repo: Repository<TransactionSigner>,
  ) {}

  getSignatureById(id: number): Promise<TransactionSigner> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  //TODO
  // i think this one actually should be getting all the transactions that the user needs to be a part of
  // how will this work exactly? go through each open transaction, get the keys required for each one, then
  // find any key that matches a users key?
  // sort of, i think we'll need to use the updateAt of transaction, any transaction that is newer than the flag will need' +
  // 'to go through this action.
  // and if that's the case, do we keep this here? yeah I think so'
  // except, a transaction needs to be checking for updates to its key all the time, everytime a user checks for stuff
  // and what not, so timestamp won't help'
  // *********** If I do two pulls, the first one pulls UNIQUE account numbers of all signing parties (will it always be an account? might just be keys)
  // then those unique account numbers are used to pull keys from mirror node
  // then use the user's list of keys to find which accounts the user is part of
  // then the second pull is all transactions that use that account info.
  // the UNIQUE part might have to be done in code, not sql, otherwise it would have to reparse all the transaction.body stuff
  // to find the accounts/keys again.
  // ***ORRRRRR**** take all the keys for the user, pull the accounts the keys belong to from the mirror node,
  // THEN use those accounts to pull transactions from the table. mabye this means that when creating a transaction,
  // it might be beneficial to list all accounts that are part of the transaction so i dont' need to go through the
  // body to figure it out as that can take forever
  // when the tranasction is saved, it will need to gather all the accounts/keys and put them somewhere. I don't want to
  // save keys directly, as that can change. I do want to store accounts. separate table or json list?
  // the 'create account' will just be keys, though, and can't look that one up, and it won't change anyway
  // or should I just make the keys searchable, as that is how the notifications are gonna work anyway?
  // either i save space and store accounts which mean sI need a lookup for each key a user has
  // or I use more space and store keys and dont lookup
  // nope, see transaction.entity - i need to use the accounts not the keys, as keys can change
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

  async uploadSignature(
    transactionId: number,
    dto: UploadSignatureDto,
  ): Promise<TransactionSigner> {
    // find the value of sign here, has it been transformed?
    const signer = await this.repo.create(dto);
    signer['transaction' as any] = transactionId;
    signer['userKey' as any] = dto.userKeyId;
    return this.repo.save(signer);
  }

  async deleteSignature(id: number): Promise<TransactionSigner> {
    const signer = await this.getSignatureById(id);
    return this.repo.remove(signer);
  }
}
