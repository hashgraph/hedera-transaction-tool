import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { NotifyEmailDto } from '@app/common';

import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { RmqContext } from '@nestjs/microservices';

describe('EmailController', () => {
  let controller: EmailController;
  const emailService = mockDeep<EmailService>();

  const mockCtx = {
    getChannelRef: () => ({ ack: jest.fn() }),
    getMessage: () => ({ properties: { headers: {} } }),
  } as unknown as RmqContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: EmailService,
          useValue: emailService,
        },
      ],
    }).compile();

    controller = app.get<EmailController>(EmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should invoke notify email with correct params', async () => {
    const dto: NotifyEmailDto = {
      email: 'receiver@email.com',
      subject: 'Test subject',
      text: 'Test text',
    };

    await controller.notifyEmail(dto, mockCtx);

    expect(emailService.notifyEmail).toHaveBeenCalledWith(dto);
  });
});
