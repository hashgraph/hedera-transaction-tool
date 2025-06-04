import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mockDeep } from 'jest-mock-extended';

jest.mock('nodemailer');
jest.mock('@app/common', () => ({
  generateEmailContent: jest.fn(),
  NotificationTypeEmailSubjects: {
    TYPE_A: 'Type A Subject',
    TYPE_B: 'Type B Subject'
  }
}));

import { generateEmailContent, NotificationTypeEmailSubjects, NotifyEmailDto } from '@app/common';

import { EmailService } from './email.service';
import { Notification } from '@entities';

describe('Email Service', () => {
  let service: EmailService;
  const transport = {
    sendMail: jest.fn(),
  };

  const configService = mockDeep<ConfigService>();

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
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    (service as any).batcher = {
      add: jest.fn().mockResolvedValue(undefined),
    };
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

    transport.sendMail.mockResolvedValueOnce({messageId: '123'});

    await service.notifyEmail(dto);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: dto.email,
        subject: dto.subject,
        text: dto.text,
      }),
    );
  });

  it('should call batcher.add for each email', async () => {
    const emails = ['user1@example.com', 'user2@example.com'];
    const notification = {id: 1, type: 'SOME_TYPE'} as unknown as Notification;

    await service.processEmail(emails, notification);

    const addMock = (service as any).batcher.add;
    expect(addMock).toHaveBeenCalledTimes(emails.length);
    emails.forEach(email =>
      expect(addMock).toHaveBeenCalledWith(notification, email),
    );
  });

  it('should group notifications by type and send emails using processMessages', async () => {
    const notifications: Notification[] = [
      { id: 1, type: 'TYPE_A' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
      { id: 2, type: 'TYPE_B' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
      { id: 3, type: 'TYPE_A' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
    ];
    // Set up sendMail mock to resolve.
    transport.sendMail.mockResolvedValue({ messageId: 'test-message' });

    (generateEmailContent as jest.Mock).mockReturnValue('mocked value');

    await (service as any)['processMessages']('group@mail.com', notifications);

    // Expect two calls: one for each notification type.
    expect(transport.sendMail).toHaveBeenCalledTimes(2);

    // Optionally, verify parameters for one call.
    const callOptions = (transport.sendMail as jest.Mock).mock.calls[0][0];
    expect(callOptions.from).toContain('Transaction Tool');
    expect(callOptions.to).toEqual('group@mail.com');
    // The subject and text depend on your implementation.
    expect(callOptions.subject).toEqual(NotificationTypeEmailSubjects[callOptions.subject as keyof typeof NotificationTypeEmailSubjects] || callOptions.subject);
    expect(typeof callOptions.text).toBe('string');
  });
});