import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserKey } from '@entities/user-key.entity';
import { Repository } from 'typeorm';
import { User } from '@entities/user.entity';
import { UploadUserKeyDto } from './dtos/upload-user-key.dto';

@Injectable()
export class UserKeysService {
  constructor(@InjectRepository(UserKey) private repo: Repository<UserKey>) {}

  // Get the user key for the provided userKeyId.
  getUserKeyById(id: number): Promise<UserKey> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  // Upload the provided user key for the provided user.
  async uploadKey(user: User, dto: UploadUserKeyDto): Promise<UserKey> {
    const userKey = this.repo.create(dto);
    userKey.user = user;
    return this.repo.save(userKey);
  }

  // Get the list of user keys for the provided userId
  async getUserKeysByUserId(userId: number): Promise<UserKey[]> {
    return this.repo
      .createQueryBuilder('userKey')
      .leftJoinAndSelect('userKey.user', 'user')
      .where('userId = :userId', { userId })
      .getMany();
  }

  // Remove the user key for the provided userKeyId.
  // This is a soft remove, meaning that the deleted timestamp will be set.
  async removeKey(id: number): Promise<UserKey> {
    const userKey = await this.getUserKeyById(id);
    if (!userKey) {
      throw new NotFoundException('key not found');
    }
    return this.repo.softRemove(userKey);
  }
}
