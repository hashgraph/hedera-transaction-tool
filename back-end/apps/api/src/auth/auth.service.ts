import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dtos';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '@entities';
import { ConfigService } from '@nestjs/config';
import { totp } from 'otplib';
import { OtpPayload } from '../interfaces/otp-payload.interface';
import { OtpDto } from './dto/otp.dto';

totp.options = { step: 60, window: 10 };

@Injectable()
export class AuthService {
  // const jwtOptions: { secret: string, expiresIn: number };
  // let otpOptions: { secret: string, expiresIn: number };

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    // this.jwtOptions = { secret: configService.get<string>('JWT_SECRET'), expiresIn: configService.get<number>('JWT_EXPIRATION') };
    // this.otpOptions = { secret: configService.get<string>('JWT_SECRET'), expiresIn: configService.get<number>('OTP_EXPIRATION') };
  }

  async createOtp(user: User, response: Response): Promise<void> {
    const secret = this.configService.get<string>('OTP_SECRET');
    // If the user exists, create an TOTP for the secret + email
    // const token = totp.generate(secret.concat(email));
    // I'm not sure if I need to add email.
    const token = totp.generate(secret);
    // Send the totp to the email
    //TODO send to notification stuff
    // remove this when complete
    console.log(token);
    // Now that it has been verified, create a jwt that is not 'verified' and
    // set it on the response.
    const otpPayload: OtpPayload = { email: user.email, verified: false };
    this.setOtpCookie(response, otpPayload);
  }

  verifyOtp(user: User, { token }: OtpDto, response: Response): boolean {
    const secret = this.configService.get<string>('OTP_SECRET');
    try {
      if (!totp.check(token, secret)) {
        throw new UnauthorizedException('Incorrect token');
      }
      // Now that it has been verified, create a new jwt that is 'valid' and
      // set it on the response.
      const otpPayload: OtpPayload = { email: user.email, verified: true };
      this.setOtpCookie(response, otpPayload);

      return true;
    } catch (err) {
      // Possible errors
      // - options validation
      // - "Invalid input - it is not base32 encoded string" (if 32 is used)
      console.error(err);
    }
  }

  private setOtpCookie(response: Response, otpPayload: OtpPayload) {
    // Get the expiration to set on the cookie
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + (totp.options.step*(totp.options.window as number)));

    const accessToken: string = this.jwtService.sign(otpPayload, { expiresIn: `10m` });
    response.cookie('otp', accessToken, {
      httpOnly: true,
      expires,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

  // Set the password for a user. This is only accessible to a user that
  // has verified an email and OTP
  async setPassword(user: User, password: string): Promise<void> {
    await this.usersService.setPassword(user, password);
  }

  // This method is temporary. SignUp will eventually become just a route for an admin (createUser) in the UsersService
  async signUp(dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  // The user is already verified, create the token and put it in the cookie for the response.
  async login(user: User, response: Response) {
    const payload: JwtPayload = { userId: user.id, email: user.email };

    // Get the expiration to set on the cookie
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + this.configService.get('JWT_EXPIRATION'));

    const accessToken: string = this.jwtService.sign(payload);
    response.cookie('Authentication', accessToken, {
      httpOnly: true,
      expires,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

  signOut() {
    // Get the token, add it to the blacklist, the user guard will need to compare the token to the blacklist
  }
}
