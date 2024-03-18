import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../entities/user.entity';
import { Serialize } from '../interceptors/serialize.interceptor';
import { AuthDto } from './dto/auth.dto';
import { GetUser } from '../decorators/get-user.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
@Serialize(AuthDto)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/signup')
  async signUp(@Body() body: CreateUserDto): Promise<User> {
    return this.authService.signUp(body);
  }

  @Post('/signin')
  async signIn(@Body() body: CreateUserDto): Promise<{ accessToken: string }> {
    return this.authService.signIn(body);
  }

  @Post('/signout')
  signOut(@GetUser() user: User) {
    console.log(user.id);
    // return this.authService.signOut(req.user['sub']);
  }
}
