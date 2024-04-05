import { Injectable } from '@nestjs/common';
import { NotifyEmailDto } from './dto/notify-email.dto';

@Injectable()
export class NotificationsService {
  async notifyEmail({ email, token }: NotifyEmailDto) {
    console.log(`Sending token (${token}) to ${email}`);
  }
}
