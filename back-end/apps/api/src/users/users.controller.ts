import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Serialize } from '../interceptors/serialize.interceptor';
import { GetUser } from '../decorators/get-user.decorator';
import { UsersService } from './users.service';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { User } from '@entities/';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto, UserDto } from './dtos';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Create a user',
    description: 'Create a user for the organization. This action requires admin privileges.',
  })
  @ApiResponse({
    status: 201,
    type: [UserDto],
  })
  @UseGuards(AdminGuard)
  @Post()
  createUser(@Body() body: CreateUserDto): Promise<User> {
    return this.usersService.createUser(body);
  }

  @ApiOperation({
    summary: 'Get all users',
    description: 'Get all users that are currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserDto],
  })
  @Get()
  getUsers(@GetUser() user: User): Promise<User[]> {
    return this.usersService.getUsers();
  }

  @ApiOperation({
    summary: 'Get the current user',
    description: 'Get the user that is currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserDto],
  })
  @Get('/me')
  getMe(@GetUser() user: User): User {
    return user;
  }

  //TODO How/when would this be used?
  @ApiOperation({
    summary: 'Get a specific user',
    description: 'Get a specific user from the organization for the given user id.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @Get('/:id')
  getUser(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.getUser({ id });
  }

  @ApiOperation({
    summary: 'Update user information',
    description: 'Update the information of the current user.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @Patch()
  updateUser(@GetUser() user: User, @Body() body: UpdateUserDto): Promise<User> {
    return this.usersService.updateUser(user.id, body);
  }

  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password of the current logged in user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully changed.',
  })
  @Patch('/change-password')
  async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(user, changePasswordDto);
  }

  @ApiOperation({
    summary: 'Remove a user',
    description: 'Remove a user from the organization for the given id.',
  })
  @ApiResponse({
    status: 200,
  })
  @Delete('/:id')
  removeUser(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.removeUser(id);
  }
}
