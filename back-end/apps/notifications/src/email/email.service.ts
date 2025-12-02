import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

import {
  EmailDto,
  generateEmailContent,
  generateResetPasswordMessage,
  generateUserRegisteredMessage,
  NotificationTypeEmailSubjects,
} from '@app/common';
import { DebouncedNotificationBatcher } from '../utils';
import { Notification } from '@entities';
import { SendMailOptions } from 'nodemailer';
import { EmailNotificationDto } from '../dtos';

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

  async processUserInviteNotifications(events: EmailDto[]) {
    await this.sendTransactionalEmails(
      events,
      'Hedera Transaction Tool Registration',
      generateUserRegisteredMessage,
      'user invite',
    );
  }

  async processUserPasswordResetNotifications(events: EmailDto[]) {
    await this.sendTransactionalEmails(
      events,
      'Password Reset Token',
      generateResetPasswordMessage,
      'password reset',
    );
  }

  private async sendTransactionalEmails(
    events: EmailDto[],
    subject: string,
    generateMessage: (payload: any) => string,
    emailType: string, // For logging
  ) {
    if (events.length === 0) return;

    for (const event of events) {
      if (!event.email) {
        console.error(`No email provided in event for ${emailType} notification`);
        continue;
      }

      if (!event.additionalData) {
        console.error(`No payload provided in event for ${emailType} notification`);
        continue;
      }

      try {
        const html = generateMessage(event.additionalData);

        await this.transporter.sendMail({
          from: `"Transaction Tool" ${this.sender}`,
          to: event.email,
          subject: subject,
          text: html.replace(/<\/?[^>]+(>|$)/g, ''), // Plain text fallback
          html: html,
        });

        console.log(`Sent ${emailType} email to ${event.email}`);
      } catch (error) {
        console.error(`Failed to send ${emailType} email to ${event.email}:`, error);
      }
    }

    console.log(`Completed sending ${events.length} ${emailType} emails`);
  }

  async processEmails(emails: EmailNotificationDto[]) {
    for (const { email, notifications } of emails) {
      for (const notification of notifications) {
        await this.batcher.add(notification, email);
      }
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

    console.log(`Processing email batch for ${groupKey} with ${notifications.length} notifications in ${groupedNotifications.size} groups.`);

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