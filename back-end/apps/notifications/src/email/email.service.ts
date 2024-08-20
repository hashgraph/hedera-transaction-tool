import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import * as nodemailer from 'nodemailer';

import { NotifyEmailDto } from '@app/common';
import { NotificationReceiver } from '@entities';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

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
      from: '"Transaction Tool" no-reply@transactiontool.com', // sender address
      to: email, // list of receivers
      subject: subject, // Subject line
      text: text, // plain text body
    });

    console.log(`Message sent: ${info.messageId}`);
  }

  async processEmail(options: nodemailer.SendMailOptions, receiverEntityIds: number[]) {
    /* 
      TODO Add to email processor queue
      Currently, just send the email
    */
    const info = await this.transporter.sendMail(options);
    console.log(`Message sent: ${info.messageId}`);

    try {
      await this.markAsSent(receiverEntityIds);
    } catch (error) {
      console.log(error);
    }
  }

  async markAsSent(receiverEntityIds: number[]) {
    await this.entityManager.update(
      NotificationReceiver,
      {
        id: In(receiverEntityIds),
      },
      { isEmailSent: true },
    );
  }
}
