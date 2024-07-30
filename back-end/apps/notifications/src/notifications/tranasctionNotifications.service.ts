import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { MirrorNodeService, NotifyForTransactionDto } from '@app/common';

import { EmailService } from '../email/email.service';

@Injectable()
export class TransactionNotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly mirrorNodeService: MirrorNodeService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

  async notifyTransactionSigners(dto: NotifyForTransactionDto) {}
}
