import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OtpJwtAuthGuard extends AuthGuard('otp-jwt') {}
