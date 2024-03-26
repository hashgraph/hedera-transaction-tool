import { Module } from '@nestjs/common';
import { UserKeysController } from './user-keys.controller';
import { UserKeysService } from './user-keys.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserKey } from '@entities/user-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserKey])],
  controllers: [UserKeysController],
  providers: [UserKeysService],
})
export class UserKeysModule {}
