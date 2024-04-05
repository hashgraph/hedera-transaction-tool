import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OtpLocalAuthGuard extends AuthGuard('otp-local') {}
