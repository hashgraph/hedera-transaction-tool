import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

import { generateEmailContent, NotificationTypeEmailSubjects, NotifyEmailDto } from '@app/common';
import { DebouncedNotificationBatcher } from '../utils';
import { Notification } from '@entities';
import { SendMailOptions } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly sender: string;
  private readonly transporter = nodemailer.createTransport({
    host: this.configService.getOrThrow<string>('EMAIL_API_HOST'),
    port: this.configService.getOrThrow<number>('EMAIL_API_PORT'),
    secure: this.configService.getOrThrow<boolean>('EMAIL_API_SECURE'),
    ...this.getAuthConfig()
  });
  private batcher: DebouncedNotificationBatcher;

  constructor(private readonly configService: ConfigService) {
    this.sender = configService.getOrThrow('SENDER_EMAIL');

    this.batcher = new DebouncedNotificationBatcher(
      this.processMessages.bind(this),
      2000,
      200,
      10000,
      this.configService.get('REDIS_URL'),
      'emails',
    );
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

  async processEmail(emails: string[], notification: Notification) {
    for (const email of emails) {
      await this.batcher.add(notification, email)
    }
  }

  private async processMessages(groupKey: string, notifications: Notification[]) {
    const groupedNotifications = notifications.reduce((map, msg) => {
      if (!map.has(msg.type)) {
        map.set(msg.type, []);
      }
      map.get(msg.type)!.push(msg);
      return map;
    }, new Map<string, Notification[]>());

    console.log(`Processing ${groupedNotifications.size} grouped notifications for ${groupKey}`);
    console.log(`Grouped notifications: ${JSON.stringify(groupedNotifications)}`);

    for (const [type, notifications] of groupedNotifications.entries()) {
      const mailOptions: SendMailOptions = {
        from: `"Transaction Tool" ${this.sender}`,
        to: groupKey,
        subject: NotificationTypeEmailSubjects[type],
        text: generateEmailContent(type, ...notifications),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Message sent: ${info.messageId}`);
    }
  };
}