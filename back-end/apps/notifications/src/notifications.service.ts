import { Injectable } from '@nestjs/common';
import { NotifyEmailDto } from './dto/notify-email.dto';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  constructor(private readonly configService: ConfigService) {}

  private readonly transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: this.configService.getOrThrow<string>('BREVO_USERNAME'),
      pass: this.configService.getOrThrow<string>('BREVO_PASSWORD'),
    }
  });

  async notifyEmail({ email, subject, text }: NotifyEmailDto) {
    // send mail with defined transport object
    let info = await this.transporter.sendMail({
      from: '"Transaction Tool" info@transactiontool.com', // sender address
      to: email, // list of receivers
      subject: subject, // Subject line
      text: text, // plain text body
    });

    console.log(`Message sent: ${info.messageId}`);
  }
}
