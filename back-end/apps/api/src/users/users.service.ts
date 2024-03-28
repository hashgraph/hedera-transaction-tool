import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserStatus } from '@entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs'; // if issues with docker, change this to bcryptjs
import { CreateUserDto } from './dtos/create-user.dto';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  // Create a user for the given email and password. This is temporary,
  // as the process for creating a new user will include a temporary password,
  // and a notification sent to the email provided.
  async createUser(dto: CreateUserDto): Promise<User> {
    let user = await this.getUser({ email: dto.email }, true);
    if (user) { // If the user is found
      if (!user.deletedAt) { // AND not deleted, throw an error
        throw new UnprocessableEntityException('Email already exists.')
      }
      // Otherwise, restore the user and update it
      await this.repo.restore(user.id);
      //TODO restoring a user should cause a new OTP to be sent, just like a new user
      return this.updateUser(user.id, { ...dto, status: UserStatus.RESET_PASSWORD });
    }
    user = this.repo.create({
      ...dto,
      password: await this.getSaltedHash(dto.password),
    });
    return await this.repo.save(user);
  }

  // Return the user for the given email and password. The returned user is valid and verified.
  async getVerifiedUser(email: string, password: string): Promise<User> {
    const user = await this.getUser({ email });

    if (!(await bcrypt.compare(password, user?.password))) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    return user;
  }

  // Return a user for given values
  getUser(where: FindOptionsWhere<User>, withDeleted=false): Promise<User> {
    if (!where) {
      return null;
    }
    return this.repo.findOne({ where, withDeleted });
  }

  // Return an array of users, containing all current users of the organization.
  getUsers(): Promise<User[]> {
    return this.repo.find();
  }

  // Update a user with the provided information.
  // If a new password is provided, it will be salted and hashed as per usual, the result will be stored.
  async updateUser(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new Error('user not found');
    }

    //TODO if the password is changing, I need to mark the user as not new/resetpassword?
    //maybe if user is 'new/resetpassword' and this supplied password is different than the old one
    //then I can change status? sounds reasonable
    if (attrs.password) {
      attrs.password = await this.getSaltedHash(attrs.password);
    }

    Object.assign(user, attrs);
    return this.repo.save(user);
  }

  // Remove a user from the organization.
  // This is a soft delete, meaning the deletedTimestamp will be set.
  async removeUser(id: number): Promise<User> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new Error('user not found');
    }

    return this.repo.softRemove(user);
  }

  // For the given password, create a salt and hash it with the password.
  // Return the result.
  async getSaltedHash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }
}
