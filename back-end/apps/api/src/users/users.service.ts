import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';

import { ErrorCodes } from '@app/common';
import { User, UserStatus } from '@entities';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  /* Creates a user with a given email and password. */
  async createUser(email: string, password: string): Promise<User> {
    let user = await this.getUser({ email }, true);
    password = await this.getSaltedHash(password);

    if (user) {
      if (!user.deletedAt) throw new UnprocessableEntityException('Email already exists.');
      return this.updateUser(user, { email, password, status: UserStatus.NEW, deletedAt: null });
    }

    user = this.repo.create({
      email,
      password,
    });

    return await this.repo.save(user);
  }

  /* Returns the user for the given email and password. The returned user is valid and verified. */
  async getVerifiedUser(email: string, password: string): Promise<User> {
    let user: User;

    try {
      user = await this.getUser({ email });
    } catch {
      throw new InternalServerErrorException('Failed to retrieve user.');
    }

    if (!user) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    const { correct, isBcrypt } = await this.dualCompareHash(password, user.password);

    if (!correct) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    if (isBcrypt) {
      await this.setPassword(user, password);
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

  async getOwnerOfPublicKey(publicKey: string): Promise<string | null> {
    const existingUser = await this.repo.findOne({
      where: { keys: { publicKey } },
      relations: ['keys'],
    });
    return existingUser ? existingUser.email : null;
  }

  async updateUserById(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new BadRequestException(ErrorCodes.UNF);
    }

    return this.updateUser(user, attrs);
  }

  // Update a user with the provided information.
  // If a new password is provided, it will be salted and hashed as per usual, the result will be stored.
  async updateUser(user: User, attrs: Partial<User>): Promise<User> {
    Object.assign(user, attrs);
    return this.repo.save(user);
  }

  // Set the password for the given user. This method is only accessible to a user that is
  // logged in and authenticated, or has verified the email and OTP
  async setPassword(user: User, newPassword: string): Promise<void> {
    // Get the salted password, and set the status to none (no longer new)
    await this.updateUser(user, {
      password: await this.getSaltedHash(newPassword),
      status: UserStatus.NONE,
    });
  }

  // Remove a user from the organization.
  // This is a soft delete, meaning the deletedTimestamp will be set.
  async removeUser(id: number): Promise<boolean> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new BadRequestException(ErrorCodes.UNF);
    }

    await this.repo.softRemove(user);

    return true;
  }

  // For the given password, create a salt and hash it with the password.
  // Return the result.
  async getSaltedHash(password: string): Promise<string> {
    return await this.hash(password);
  }

  /* Compare the given data with the hash */
  async dualCompareHash(data: string, hash: string) {
    const matchBcrypt = await bcrypt.compare(data, hash);
    const matchArgon2 = await argon2.verify(hash, data);
    return { correct: matchBcrypt || matchArgon2, isBcrypt: matchBcrypt };
  }

  async hash(data: string, usePseudoSalt = false): Promise<string> {
    let pseudoSalt: Buffer | undefined;
    if (usePseudoSalt) {
      const paddedData = data.padEnd(16, 'x');
      pseudoSalt = Buffer.from(paddedData.slice(0, 16));
    }
    return await argon2.hash(data, {
      salt: pseudoSalt,
    });
  }

  async getAdmins() {
    return await this.repo.find({ where: { admin: true } });
  }
}
