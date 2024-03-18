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
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@Serialize(UserDto)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Eventually will add create user
  //@Post()
  //createUser() {}

  @Get()
  getUsers(@GetUser() user: User) {
    return this.usersService.getUsers();
  }

  @Get('/:id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserById(id);
  }

  @Patch()
  updateUser(@GetUser() user: User, @Body() body: UpdateUserDto) {
    return this.usersService.updateUser(user.id, body);
  }

  @Delete('/:id')
  removeUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeUser(id);
  }
}
