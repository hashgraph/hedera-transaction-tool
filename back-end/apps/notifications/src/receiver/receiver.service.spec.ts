import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { MirrorNodeService } from '@app/common';

import { ReceiverService } from './receiver.service';
import { EmailService } from '../email/email.service';

jest.mock('@app/common/utils');

describe('Receiver Service', () => {
  let service: ReceiverService;
  const configService = mockDeep<ConfigService>();
  const emailService = mockDeep<EmailService>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiverService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
      ],
    }).compile();

    service = module.get<ReceiverService>(ReceiverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
