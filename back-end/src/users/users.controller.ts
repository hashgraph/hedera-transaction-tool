import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Serialize } from '../interceptors/serialize.interceptor';
import { UserDto } from './dtos/user.dto';
import { GetUser } from '../decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@Serialize(UserDto)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Eventually will add create user
  //@Post()
  //createUser() {}

  @ApiOperation({
    summary: 'Get all users',
    description: 'Get all users that are currently a part of the organization.',
  })
  @ApiResponse({
    status: 201,
    type: [UserDto],
  })
  @Get()
  getUsers(@GetUser() user: User): Promise<User[]> {
    return this.usersService.getUsers();
  }

  //TODO How/when would this be used?
  @ApiOperation({
    summary: 'Get a specific user',
    description: 'Get a specific user from the organization for the given user id.',
  })
  @ApiResponse({
    status: 201,
    type: UserDto,
  })
  @Get('/:id')
  getUser(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.getUserById(id);
  }

  @ApiOperation({
    summary: 'Update user information',
    description: 'Update the information of the current user.',
  })
  @ApiResponse({
    status: 201,
    type: UserDto,
  })
  @Patch()
  updateUser(@GetUser() user: User, @Body() body: UpdateUserDto): Promise<User> {
    return this.usersService.updateUser(user.id, body);
  }

  @ApiOperation({
    summary: 'Remove a user',
    description: 'Remove a user from the organization for the given id.',
  })
  @ApiResponse({
    status: 201,
  })
  @Delete('/:id')
  removeUser(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.removeUser(id);
  }
}
