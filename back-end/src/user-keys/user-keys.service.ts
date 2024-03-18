import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserKey } from '../entities/user-key.entity';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UploadUserKeyDto } from './dtos/upload-user-key.dto';

@Injectable()
export class UserKeysService {
  constructor(@InjectRepository(UserKey) private repo: Repository<UserKey>) {}

  findOne(id: number): Promise<UserKey> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  async uploadKey(user: User, dto: UploadUserKeyDto): Promise<UserKey> {
    const userKey = await this.repo.create(dto);
    userKey.user = user;
    return this.repo.save(userKey);
  }

  async getKeysById(userId: number): Promise<UserKey[]> {
    return this.repo
      .createQueryBuilder('userKey')
      .leftJoinAndSelect('userKey.user', 'user')
      .where('userId = :userId', { userId })
      .getMany();
    //TODO this doesn't work, though it looks nice. Is there a way to get it to work?
    // maybe I would have to separately get user? the user.id in the where doesn't do anything.
    // return this.repo.find({
    //   relations: ['user'],
    //   where: { user.id: userId },
    // });
  }

  async removeKey(id: number): Promise<UserKey> {
    const userKey = await this.findOne(id);
    if (!userKey) {
      throw new NotFoundException('key not found');
    }
    return this.repo.softRemove(userKey);
  }
}
