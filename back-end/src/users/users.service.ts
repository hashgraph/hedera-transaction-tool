import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  //TODO createUser should throw some sort of error if the email is already in use
  async createUser(email: string, password: string): Promise<User> {
    const hashedPassword = await this.getSaltedHash(password);

    const user = this.repo.create({ email, password: hashedPassword });
    return await this.repo.save(user);
  }

  async getVerifiedUser(email: string, password: string): Promise<User> {
    const user = await this.getUserByEmail(email);

    if (!(await bcrypt.compare(password, user?.password))) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    return user;
  }

  getUserById(id: number): Promise<User> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  getUserByEmail(email: string): Promise<User> {
    if (!email) {
      return null;
    }
    return this.repo.findOneBy({ email });
  }

  getUsers(): Promise<User[]> {
    return this.repo.find();
    // This will return all users, even deleted ones
    // return this.repo.find({ withDeleted: true });
  }

  async updateUser(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.getUserById(id);

    if (!user) {
      throw new Error('user not found');
    }

    if (attrs.password) {
      attrs.password = await this.getSaltedHash(attrs.password);
    }

    Object.assign(user, attrs);
    return this.repo.save(user);
  }

  async removeUser(id: number): Promise<User> {
    const user = await this.getUserById(id);

    if (!user) {
      throw new Error('user not found');
    }

    return this.repo.softRemove(user);
  }

  async getSaltedHash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }
}
