import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

import { NotifyEmailDto } from '@app/common';

@Injectable()
export class EmailService {
  private readonly sender: string;
  private readonly transporter = nodemailer.createTransport({
    host: this.configService.getOrThrow<string>('EMAIL_API_HOST'),
    port: this.configService.getOrThrow<number>('EMAIL_API_PORT'),
    secure: this.configService.getOrThrow<boolean>('EMAIL_API_SECURE'),
    ...this.getAuthConfig()
  });

  constructor(private readonly configService: ConfigService) {
    this.sender = configService.getOrThrow('SENDER_EMAIL');
  }

  private getAuthConfig() {
    const user = this.configService.get<string>('EMAIL_API_USERNAME');
    const pass = this.configService.get<string>('EMAIL_API_PASSWORD');
    return user && pass ? { auth: { user, pass } } : {};
  }

  async notifyEmail({ email, subject, text }: NotifyEmailDto) {
    // send mail with defined transport object
    const info = await this.transporter.sendMail({
      from: `"Transaction Tool" ${this.sender}`,
      to: email, // list of receivers
      subject: subject, // Subject line
      text: text.replace(/<\/?[^>]+(>|$)/g, ''), // plain text fallback
      html: text, // plain text body
    });

    console.log(`Message sent: ${info.messageId}`);
  }

  async processEmail(options: nodemailer.SendMailOptions) {
    /* 
      TODO Add to email processor queue
      Currently, just send the email
    */
    const info = await this.transporter.sendMail(options);
    console.log(`Message sent: ${info.messageId}`);
  }
}
