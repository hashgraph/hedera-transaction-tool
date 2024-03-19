import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../entities/user.entity';
import { JwtPayload } from './jwt/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // the idea seems to be that passport-local will do the password checking (signIn)
  // then passport-jwt is used to do the token issuing and checking
  // indeed, implement this later https://docs.nestjs.com/recipes/passport

  // This method is temporary. SignUp will eventually become just a route for an admin (createUser) in the UsersService
  async signUp({ email, password }: CreateUserDto): Promise<User> {
    return this.usersService.createUser(email, password);
  }

  // UsersService does the password hashing, it will verify the credentials
  async signIn({
    email,
    password,
  }: CreateUserDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.getVerifiedUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: JwtPayload = { sub: user.id, email };
    // sign or await a signAsync? same thing?
    const accessToken: string = this.jwtService.sign(payload);
    return { accessToken };
  }

  signOut() {
    // Get the token, add it to the blacklist
  }
}
