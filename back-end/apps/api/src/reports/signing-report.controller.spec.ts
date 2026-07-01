import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';

import { SigningReportController } from './signing-report.controller';
import { SigningReportService } from './signing-report.service';
import {
  SigningEntityType,
  SigningReportFormat,
  SigningReportItemDto,
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

  const rows: SigningReportItemDto[] = [
    {
      transactionId: '0.0.1001@1700000000.000000000',
      createdAt: '2025-12-31T00:00:00.000Z',
      validStart: '2026-01-01T00:00:00.000Z',
      executedAt: '2026-01-01T00:00:01.000Z',
      entityType: SigningEntityType.ACCOUNT,
      entityId: '0.0.55',
      publicKey: 'pk_alice',
      userId: 7,
      userEmail: 'alice@example.com',
      signedAt: '2026-01-01T00:00:03.000Z',
      signingStatus: SigningStatus.SIGNED,
    },
  ];

  const query: SigningReportQueryDto = {
    type: SigningReportType.TRANSACTION,
    id: '42',
    mirrorNetwork: 'testnet',
  };

  function mockRes() {
    return { header: jest.fn() } as unknown as Response;
  }

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns CSV by default and sets the CSV headers', async () => {
    service.getSigningReport.mockResolvedValue(rows);
    const res = mockRes();

    const result = await controller.getSigningReport(query, res);

    expect(service.getSigningReport).toHaveBeenCalledWith(query);
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="signing-report.csv"',
    );
    expect(typeof result).toBe('string');
    expect(result as string).toContain('transactionId,createdAt');
    expect(result as string).toContain('0.0.1001@1700000000.000000000');
  });

  it('returns the JSON array when format=json', async () => {
    service.getSigningReport.mockResolvedValue(rows);
    const res = mockRes();

    const result = await controller.getSigningReport(
      { ...query, format: SigningReportFormat.JSON },
      res,
    );

    expect(result).toBe(rows);
    expect(res.header).not.toHaveBeenCalled();
  });
});
