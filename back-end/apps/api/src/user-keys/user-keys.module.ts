import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserKey } from '@entities';

import { UserKeysController } from './user-keys.controller';
import { UserKeysAllController } from './user-keys-all.controller';
import { UserKeysService } from './user-keys.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserKey])],
  controllers: [UserKeysController, UserKeysAllController],
  providers: [UserKeysService],
  exports: [UserKeysService],
})
export class UserKeysModule {}
