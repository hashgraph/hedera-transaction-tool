import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';

import { SigningReportController } from './signing-report.controller';
import { SigningReportService } from './signing-report.service';
import {
  SigningEntityType,
  SigningReportQueryDto,
  SigningReportType,
  SigningStatus,
} from './dto/signing-report.dto';

describe('SigningReportController', () => {
  let controller: SigningReportController;

  const service = mockDeep<SigningReportService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SigningReportController],
      providers: [{ provide: SigningReportService, useValue: service }],
    })
      .overrideGuard(JwtBlackListAuthGuard)
      .useValue(guardMock())
      .overrideGuard(JwtAuthGuard)
      .useValue(guardMock())
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .overrideGuard(AdminGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get(SigningReportController);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to the service and returns the result', async () => {
    const query: SigningReportQueryDto = {
      type: SigningReportType.TRANSACTION,
      id: '42',
      mirrorNetwork: 'testnet',
    };
    const expected = [
      {
        transactionId: 42,
        createdAt: '2025-12-31T00:00:00.000Z',
        validStart: '2026-01-01T00:00:00.000Z',
        executedAt: '2026-01-01T00:00:01.000Z',
        entityType: SigningEntityType.ACCOUNT,
        entityId: '0.0.55',
        publicKey: 'pk_alice',
        userId: 7,
        userEmail: 'alice@example.com',
        signingStatus: SigningStatus.SIGNED,
      },
    ];

    service.getSigningReport.mockResolvedValue(expected);

    const result = await controller.getSigningReport(query);

    expect(service.getSigningReport).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });
});
