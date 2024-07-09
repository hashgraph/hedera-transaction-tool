import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { EmailController } from './email.controller';

import { EmailService } from './email.service';
import { NotifyEmailDto, NotifyTransactionMembersDto } from './dtos';

describe('EmailController', () => {
  let controller: EmailController;
  const emailService = mockDeep<EmailService>();

  beforeEach(async () => {
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

    await controller.notifyEmail(dto);

    expect(emailService.notifyEmail).toHaveBeenCalledWith(dto);
  });

  it('should invoke notify transaction members with correct params', async () => {
    const dto: NotifyTransactionMembersDto = {};

    await controller.notifyTransactionMembers(dto);

    expect(emailService.notifyTransactionMembers).toHaveBeenCalledWith(dto);
  });
});
