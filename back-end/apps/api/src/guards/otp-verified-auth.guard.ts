import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OtpVerifiedAuthGuard extends AuthGuard('otp-verified') {}
