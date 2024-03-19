import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { jwtConstants } from './constants';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({}),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: {
        expiresIn: 36000,
      },
    }),
    TypeOrmModule.forFeature([User]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
