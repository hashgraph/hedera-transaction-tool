import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';

import { attachKeys, ErrorCodes, MAX_USER_KEYS } from '@app/common';
import { User, UserKey } from '@entities';

import { UploadUserKeyDto } from './dtos';

@Injectable()
export class UserKeysService {
  constructor(@InjectRepository(UserKey) private repo: Repository<UserKey>) {}

  // Get the user key for the provided where clause.
  getUserKey(
    where: FindOptionsWhere<UserKey>,
    relations?: FindOptionsRelations<UserKey>,
  ): Promise<UserKey> {
    if (!where) {
      return null;
    }
    return this.repo.findOne({ where, relations });
  }

  // Upload the provided user key for the provided user.
  async uploadKey(user: User, dto: UploadUserKeyDto): Promise<UserKey> {
    await attachKeys(user, this.repo.manager);

    // Check if the user already has the maximum number of keys
    if (user.keys.length >= MAX_USER_KEYS) {
      throw new BadRequestException(ErrorCodes.UMK);
    }

    // Find the userKey by the publicKey
    let userKey = await this.repo.findOne({
      where: { publicKey: dto.publicKey },
      withDeleted: true,
    });

    if (userKey) {
      // If the userKey found is owned by a different user,
      // or if the userKey has a non null hash or index that doesn't
      // match the hash or index provided
      // throw an error.
      if (userKey.userId !== user.id || (userKey.index && userKey.index !== dto.index)) {
        throw new BadRequestException(ErrorCodes.PU);
      }
      // Set the hash and/or index (only if the current value is null)
      Object.assign(userKey, dto);
    } else {
      userKey = await this.repo.create(dto);
      userKey.user = user;
    }

    if (userKey.deletedAt) {
      await this.repo.recover(userKey);
    }
    return this.repo.save(userKey);
  }

  // Get the list of user keys for the provided userId
  async getUserKeysRestricted(user: User, userId: number): Promise<UserKey[]> {
    if (!userId) return [];
    return this.repo.find({
      where: { userId },
      select: {
        id: true,
        userId: true,
        mnemonicHash: user.id === userId,
        index: user.id === userId,
        publicKey: true,
        deletedAt: true,
      },
    });
  }

  // Remove the user key for the provided userKeyId.
  // This is a soft remove, meaning that the deleted timestamp will be set.
  async removeKey(id: number): Promise<boolean> {
    const userKey = await this.getUserKey({ id });
    if (!userKey) {
      throw new BadRequestException(ErrorCodes.KNF);
    }
    await this.repo.softRemove(userKey);

    return true;
  }

  async removeUserKey(user: User, id: number): Promise<boolean> {
    const userKey = await this.getUserKey({ id });

    if (!userKey) {
      throw new BadRequestException(ErrorCodes.KNF);
    }

    if (userKey.userId !== user.id) {
      throw new BadRequestException(ErrorCodes.PNY);
    }

    await this.repo.softRemove(userKey);

    return true;
  }

  /* Returns the count of the user keys for the provided user */
  async getUserKeysCount(userId: number): Promise<number> {
    return this.repo.count({ where: { userId } });
  }
}
