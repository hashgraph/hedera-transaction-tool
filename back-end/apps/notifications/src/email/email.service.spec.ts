import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager, In } from 'typeorm';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mockDeep } from 'jest-mock-extended';

import { NotifyEmailDto } from '@app/common';
import { NotificationReceiver } from '@entities';

import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('Email Service', () => {
  let service: EmailService;
  const transport = {
    sendMail: jest.fn(),
  };

  const configService = mockDeep<ConfigService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(async () => {
    jest.resetAllMocks();

    jest
      .mocked(createTransport)
      .mockReturnValue(transport as unknown as Transporter<SMTPTransport.SentMessageInfo>);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send email', async () => {
    const dto: NotifyEmailDto = {
      email: 'receiver@email.com',
      subject: 'Test subject',
      text: 'Test text',
    };

    transport.sendMail.mockResolvedValueOnce({ messageId: '123' });

    await service.notifyEmail(dto);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: dto.email,
        subject: dto.subject,
        text: dto.text,
      }),
    );
  });

  it('should process email and mark as sent', async () => {
    const dto: SendMailOptions = {
      to: 'test@example.com',
      subject: 'Test subject',
      text: 'Test text',
    };

    const receiverEntityIds: number[] = [1, 2, 3];

    transport.sendMail.mockResolvedValueOnce({ messageId: '123' });

    await service.processEmail(
      {
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
      },
      receiverEntityIds,
    );

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
      }),
    );

    expect(entityManager.update).toHaveBeenCalledWith(
      NotificationReceiver,
      {
        id: In(receiverEntityIds),
      },
      { isEmailSent: true },
    );
  });

  it('should catch error when marking as sent', async () => {
    const dto: SendMailOptions = {
      to: 'test@example.com',
      subject: 'Test subject',
      text: 'Test text',
    };

    const receiverEntityIds: number[] = [1, 2, 3];

    transport.sendMail.mockResolvedValueOnce({ messageId: '123' });
    entityManager.update.mockRejectedValueOnce(new Error('Failed to update'));

    await service.processEmail(
      {
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
      },
      receiverEntityIds,
    );

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
      }),
    );

    expect(entityManager.update).toHaveBeenCalledWith(
      NotificationReceiver,
      {
        id: In(receiverEntityIds),
      },
      { isEmailSent: true },
    );
  });
});
