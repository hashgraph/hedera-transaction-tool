import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class InitializedGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const users = await this.usersService.getUsers();
      return users.length === 0;
    } catch (error) {
      throw new InternalServerErrorException('Error while checking user count');
    }
  }
}