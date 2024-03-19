import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../entities/user.entity';
import { Serialize } from '../interceptors/serialize.interceptor';
import { AuthDto } from './dto/auth.dto';
import { GetUser } from '../decorators/get-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../users/dtos/user.dto';

@ApiTags('Authentication')
@Controller('auth')
@Serialize(AuthDto)
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: 'Create a new User',
    description: 'TEMPORARY! This method will be an admin-role protected method. It is included now for testing.',
  })
  @ApiResponse({
    status: 201,
    type: UserDto,
  })
  @Post('/signup')
  async signUp(@Body() body: CreateUserDto): Promise<User> {
    return this.authService.signUp(body);
  }

  @ApiOperation({
    summary: 'Sign in',
    description: 'Using the provided credentials, attempt to sign the user into the organization.',
  })
  @ApiResponse({
    status: 201,
  })
  @Post('/signin')
  async signIn(@Body() body: CreateUserDto): Promise<{ accessToken: string }> {
    return this.authService.signIn(body);
  }

  @ApiOperation({
    summary: 'Sign out',
    description: 'Sign the user out of the organization. This is not yet implemented.'
  })
  @ApiResponse({
    status: 201,
  })
  @Post('/signout')
  signOut(@GetUser() user: User) {
    console.log(user.id);
    // return this.authService.signOut(req.user['sub']);
  }
}
