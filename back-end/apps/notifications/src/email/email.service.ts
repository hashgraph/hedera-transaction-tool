import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

import { NotifyEmailDto, NotifyTransactionMembersDto } from './dtos';

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  private readonly transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: this.configService.getOrThrow<string>('BREVO_USERNAME'),
      pass: this.configService.getOrThrow<string>('BREVO_PASSWORD'),
    },
  });

  async notifyEmail({ email, subject, text }: NotifyEmailDto) {
    // send mail with defined transport object
    const info = await this.transporter.sendMail({
      from: '"Transaction Tool" info@transactiontool.com', // sender address
      to: email, // list of receivers
      subject: subject, // Subject line
      text: text, // plain text body
    });

    console.log(`Message sent: ${info.messageId}`);
  }

  async notifyTransactionMembers({ emails, subject, text }: NotifyTransactionMembersDto) {
    for (let i = 0; i < emails.length; i++) {
      const info = await this.transporter.sendMail({
        from: '"Transaction Tool" info@transactiontool.com', // sender address
        to: emails[i], // list of receivers
        subject: subject, // Subject line
        text: text, // plain text body
      });

      console.log(`Message sent: ${info.messageId}`);
    }
  }
}
