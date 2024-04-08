import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from '@app/common';
import { JwtStrategy, LocalStrategy } from './strategies';
import { User } from '@entities';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [
    LoggerModule,
    PassportModule.register({}),
    JwtModule.registerAsync({
      imports: [], // imports is required, but it doesn't appear to require ConfigModule, maybe because it isGlobal?
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRATION')}d`,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, Reflector],
})
export class AuthModule {}
