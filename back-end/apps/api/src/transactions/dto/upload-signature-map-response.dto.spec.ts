import { plainToInstance } from 'class-transformer';
import { UploadSignatureMapResponseDto } from './upload-signature-map-response.dto';
import { TransactionSignerDto } from './transaction-signer.dto';

describe('UploadSignatureMapResponseDto', () => {
  it('should expose signers and notificationReceiverIds', () => {
    const raw = {
      signers: [
        { id: 1, transactionId: 10, userKeyId: 3, createdAt: new Date(), sensitiveField: 'secret' },
        { id: 2, transactionId: 11, userKeyId: 4, createdAt: new Date(), sensitiveField: 'secret' },
      ],
      notificationReceiverIds: [100, 200],
    };

    const result = plainToInstance(UploadSignatureMapResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(result).toBeInstanceOf(UploadSignatureMapResponseDto);
    expect(result.notificationReceiverIds).toEqual([100, 200]);
    expect(result.signers).toHaveLength(2);
  });

  it('should transform signers into TransactionSignerDto instances', () => {
    const raw = {
      signers: [
        { id: 1, transactionId: 10, userKeyId: 3, createdAt: new Date() },
      ],
      notificationReceiverIds: [],
    };

    const result = plainToInstance(UploadSignatureMapResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(result.signers[0]).toBeInstanceOf(TransactionSignerDto);
    expect(result.signers[0].id).toBe(1);
    expect(result.signers[0].transactionId).toBe(10);
    expect(result.signers[0].userKeyId).toBe(3);
  });

  it('should strip fields not exposed on TransactionSignerDto', () => {
    const raw = {
      signers: [
        { id: 1, transactionId: 10, userKeyId: 3, createdAt: new Date(), sensitiveField: 'secret', userId: 99 },
      ],
      notificationReceiverIds: [],
    };

    const result = plainToInstance(UploadSignatureMapResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect((result.signers[0] as any).sensitiveField).toBeUndefined();
    expect((result.signers[0] as any).userId).toBeUndefined();
  });

  it('should handle empty signers and notificationReceiverIds', () => {
    const raw = {
      signers: [],
      notificationReceiverIds: [],
    };

    const result = plainToInstance(UploadSignatureMapResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(result.signers).toEqual([]);
    expect(result.notificationReceiverIds).toEqual([]);
  });

  it('should strip fields not in UploadSignatureMapResponseDto', () => {
    const raw = {
      signers: [],
      notificationReceiverIds: [],
      unexpectedField: 'should be stripped',
    };

    const result = plainToInstance(UploadSignatureMapResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect((result as any).unexpectedField).toBeUndefined();
  });
});