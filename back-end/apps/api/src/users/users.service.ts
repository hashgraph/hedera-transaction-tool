import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs'; // if issues with docker, change this to bcryptjs
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  // Create a user for the given email and password. This is temporary,
  // as the process for creating a new user will include a temporary password,
  // and a notification sent to the email provided.
  async createUser(dto: CreateUserDto): Promise<User> {
    let user = await this.getUserByEmail(dto.email);
    if (user) {
      throw new UnprocessableEntityException('Email already exists.')
    }
    user = this.repo.create({
      ...dto,
      password: await this.getSaltedHash(dto.password),
    });
    return await this.repo.save(user);
  }

  // //If the above doesn't work
  // async create(dto: CreateUserDto): Promise<User> {
  //   await this.validateCreateUserDto(dto);
  //   return this.repo.create({
  //     ...dto,
  //     password: await this.getSaltedHash(dto.password),
  //   });
  // }
  // private async validateCreateUserDto(dto: CreateUserDto) {
  //   try {
  //     await this.repo.findOneBy({ email: dto.email });
  //   } catch (err) {
  //     return;
  //   }
  //   throw new UnprocessableEntityException('Email already exists.');
  // }

  // Return the user for the given email and password. The returned user is valid and verified.
  async getVerifiedUser(email: string, password: string): Promise<User> {
    const user = await this.getUserByEmail(email);

    if (!(await bcrypt.compare(password, user?.password))) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    return user;
  }

  // Return a user for the given user id.
  getUserById(id: number): Promise<User> {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  // Return a user for the given email (username)
  getUserByEmail(email: string): Promise<User> {
    if (!email) {
      return null;
    }
    return this.repo.findOneBy({ email });
  }

  // Return an array of users, containing all current users of the organization.
  getUsers(): Promise<User[]> {
    return this.repo.find();
    // This will return all users, even deleted ones
    // return this.repo.find({ withDeleted: true });
  }

  // Update a user with the provided information.
  // If a new password is provided, it will be salted and hashed as per usual, the result will be stored.
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

  // Remove a user from the organization.
  // This is a soft delete, meaning the deletedTimestamp will be set.
  async removeUser(id: number): Promise<User> {
    const user = await this.getUserById(id);

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
