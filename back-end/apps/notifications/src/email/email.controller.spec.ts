import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

describe('NotificationsController', () => {
  let notificationsController: EmailController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [EmailService],
    }).compile();

    notificationsController = app.get<EmailController>(EmailController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(notificationsController.getHello()).toBe('Hello World!');
    });
  });
});
