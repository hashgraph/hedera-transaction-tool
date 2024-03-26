import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dtos/create-user.dto';
import { User } from '@entities/user.entity';
import { Serialize } from '../interceptors/serialize.interceptor';
import { AuthDto } from './dto/auth.dto';
import { GetUser } from '../decorators/get-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../users/dtos/user.dto';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { MessagePattern } from '@nestjs/microservices';

@ApiTags('Authentication')
@Controller('auth')
@Serialize(AuthDto)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Create a new User',
    description:
      'TEMPORARY! This method will be an admin-role protected method. It is included now for testing.',
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
    summary: 'Login in',
    description: 'Using the provided credentials, attempt to log the user into the organization.',
  })
  @ApiResponse({
    status: 201,
  })
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.login(user, response);
    response.send(user);
  }

  @ApiOperation({
    summary: 'Log out',
    description: 'Log the user out of the organization. This is not yet implemented.'
  })
  @ApiResponse({
    status: 201,
  })
  @Post('/logout')
  logout(@GetUser() user: User) {
    console.log(user.id);
    // return this.authService.signOut(req.user['sub']);
  }

  //lesson 18
  // @MessagePattern('authenticate')
  // async authentiate() {}
}
