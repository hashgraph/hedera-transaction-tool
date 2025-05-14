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


  // still need to figure out how to process and group. if Im going to group, then I should have the 'processemails' but the part that generates the messages
  // based on type and additionaldata because generating will depend on the number of emails going out.
  // hmm, emails should be grouped by user email AND notification type. currently the debounce batcher thign only groups by string or number. so unless I combine
  // email and type into one string, that may not work. So yes, probably group. that means that the 'content' of the message will need to be email and all the data needed
  // to generate.
  //
  // sendmailoptions allows for sending to multiple people - does that count as 1 email? or lots of emails? many for brevo, but one request
  // from nodemailer. so I really want to group the emails by type AND user emailS, not just email. then if I get an email for a single transaction
  // and one from a transaction group, it will be 2 separate emails. meh, not sure that's better, but nodemailer will like it more'
  //
  // what if I only separate based on type, then take all the emails fo the same type and send them out in one request based on email count in all the lists?
  // so like each 'notificationmessage' will have the list of emails still, then I combine all the lists and generate a messaged based on the number
  // of times the user's email shows up in all the lists' +
  //
  // but do I want to combine different types? like 'transaction ready to sign' and 'transaction ready to execute'? if so, then the subject would
  // need to change. I don't like that. let's say no for now. just the group question: should i get 1 for all 'tarnsactions ready to sign' no
  // matter if in a group and some not, or different networks, etc?
  //
  // I could sepatare based on email, then just group by type probably better
  //
  // sounds like it is better to group by email, then the message will be the type and data.
  // then processing will get each user, and group up the similar types as needed.
  //
  // the reason to do it that was is because the other way will cause a user to receive more emails, possibly, and the possible reduciton
  // in brevo calls is not worth it. additionally, grouping by user will make it easier to combine notifications in a pleasant way

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