import { BadRequestException, Injectable, UnauthorizedException, UnprocessableEntityException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import * as bcrypt from 'bcryptjs'; // if issues with docker, change this to bcryptjs
import { ChangePasswordDto, CreateUserDto } from './dtos';
import { User, UserStatus } from '@entities';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  // Create a user for the given email and password. This is temporary,
  // as the process for creating a new user will include a temporary password,
  // and a notification sent to the email provided.
  async createUser(dto: CreateUserDto): Promise<User> {
    let user = await this.getUser({ email: dto.email }, true);
    if (user) {
      // If the user is found
      if (!user.deletedAt) {
        // AND not deleted, throw an error
        throw new UnprocessableEntityException('Email already exists.');
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
  getUser(where: FindOptionsWhere<User>, withDeleted = false): Promise<User> {
    // If where is null, or all values in where are null, return null
    if (!where || Object.values(where).every(value => !value)) {
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

    Object.assign(user, attrs);
    return this.repo.save(user);
  }

  // Change the password for the given user. This method is only accessible to a user that is
  // logged in and authenticated
  async changePassword(user: User, { oldPassword, newPassword }: ChangePasswordDto): Promise<void> {
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }
    await this.setPassword(user, newPassword);
  }

  // Set the password for the given user. This method is only accessible to a user that is
  // logged inn and authenticated, or has verified the email and OTP
  async setPassword(user: User, newPassword: string): Promise<void> {
    await this.updateUser(user.id, { password: await this.getSaltedHash(newPassword) });
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
    return await bcrypt.hash(password, salt);
  }
}
