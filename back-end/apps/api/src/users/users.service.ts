import {
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

import { Response } from 'express';
import { totp } from 'otplib';

import * as bcrypt from 'bcryptjs';

import { NOTIFICATIONS_SERVICE } from '@app/common';

import { User, UserStatus } from '@entities';

import { CreateUserDto, OtpDto } from './dtos';

import { OtpPayload } from '../interfaces/otp-payload.interface';

totp.options = {
  digits: 8,
  step: 60,
  window: 20,
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
  ) {}

  async createOtp(user: User, response: Response): Promise<void> {
    const email = user.email;
    const secret = this.getOtpSecret(email);
    // If the user exists, create an TOTP for the secret + email
    // const token = totp.generate(secret.concat(email));
    // I'm not sure if I need to add email.
    const token = totp.generate(secret);
    // Send the totp to the email
    this.notificationsService.emit('notify_email', {
      email,
      subject: 'Password Reset',
      text: `Hello, your OTP is ${token}`,
    });
    // Now that it has been verified, create a jwt that is not 'verified' and
    // set it on the response.
    const otpPayload: OtpPayload = { email, verified: false };
    this.setOtpCookie(response, otpPayload);
  }

  async verifyOtp(user: User, { token }: OtpDto, response: Response): Promise<boolean> {
    const email = user.email;
    const secret = this.getOtpSecret(email);
    try {
      if (!totp.check(token, secret)) {
        throw new UnauthorizedException('Incorrect token');
      }
      // Now that it has been verified, create a new jwt that is 'valid' and
      // set it on the response.
      const otpPayload: OtpPayload = { email, verified: true };
      this.setOtpCookie(response, otpPayload);

      // Change the user status to 'NEW'. For a new user, this is no change.
      // For a current user, this locks them from the organization data until a new password is set.
      await this.updateUser(user, { status: UserStatus.NEW });

      return true;
    } catch (err) {
      // Possible errors
      // - options validation
      // - "Invalid input - it is not base32 encoded string" (if 32 is used)
      console.error(err);
    }
  }

  // Get the otp secret and add the email, making it unique per user.
  // The other approach would be to create a unique key per user and store
  // it in the database.
  private getOtpSecret(email: string): string {
    return this.configService.get<string>('OTP_SECRET').concat(email);
  }

  private setOtpCookie(response: Response, otpPayload: OtpPayload) {
    // Get the expiration to set on the cookie
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + totp.options.step * (totp.options.window as number));

    const accessToken: string = this.jwtService.sign(otpPayload);
    response.cookie('otp', accessToken, {
      httpOnly: true,
      expires,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

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

      return this.updateUser(user, { admin: dto.admin, status: UserStatus.NEW });
    }

    //TODO this needs to be removed once the createUser route in auth.controller is removed
    // as password will not be in the CreateUserDto
    const password = dto.password ? await this.getSaltedHash(dto.password) : '';
    user = this.repo.create({
      ...dto,
      password,
    });
    return await this.repo.save(user);
  }

  /* Returns the user for the given email and password. The returned user is valid and verified. */
  async getVerifiedUser(email: string, password: string): Promise<User> {
    let user: User;

    try {
      user = await this.getUser({ email });
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve user.');
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
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

  async updateUserById(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new Error('user not found');
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
