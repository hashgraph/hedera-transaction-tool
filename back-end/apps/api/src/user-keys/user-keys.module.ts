import { Module } from '@nestjs/common';
import { UserKeysController } from './user-keys.controller';
import { UserKeysService } from './user-keys.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserKey } from '@entities';

@Module({
  imports: [TypeOrmModule.forFeature([UserKey])],
  controllers: [UserKeysController],
  providers: [UserKeysService],
  exports: [UserKeysService],
})
export class UserKeysModule {}
