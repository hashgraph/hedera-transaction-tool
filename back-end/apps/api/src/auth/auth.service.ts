import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dtos';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '@entities';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // This method is temporary. SignUp will eventually become just a route for an admin (createUser) in the UsersService
  async signUp(dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  // The user is already verified, create the token and put it in the cookie for the response.
  async login(user: User, response: Response) {
    const payload: JwtPayload = { userId: user.id, email: user.email };

    // Get the expiration to set on the cookie
    const expires = new Date();
    //TODO is there a better way to make the cookie and the JWT expiration to match?
    expires.setSeconds(expires.getSeconds() + this.configService.get<number>('JWT_EXPIRATION')*24*60*60);

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
