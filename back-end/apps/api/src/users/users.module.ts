import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entities';
import { DatabaseModule } from '@app/common';
import { OtpJwtStrategy, OtpLocalStrategy, OtpVerifiedStrategy } from './strategies';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [], // imports is required, but it doesn't appear to require ConfigModule, maybe because it isGlobal?
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('OTP_EXPIRATION')}m`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, OtpJwtStrategy, OtpLocalStrategy, OtpVerifiedStrategy ],
  exports: [UsersService],
})
export class UsersModule {}