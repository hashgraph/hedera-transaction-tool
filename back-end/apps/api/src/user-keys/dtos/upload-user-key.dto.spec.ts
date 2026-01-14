import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UploadUserKeyDto } from './upload-user-key.dto';
import { ErrorCodes } from '@app/common';

describe('UploadUserKeyDto', () => {
  const validPublicKey = '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';
  const normalizedPublicKey = 'e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';
  const validMnemonicHash = 'some-mnemonic-hash';
  const validIndex = 0;

  describe('publicKey validation', () => {
    it('should fail if publicKey is empty', async () => {
      const dto = plainToClass(UploadUserKeyDto, { publicKey: '' });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'publicKey')).toBe(true);
    });

    it('should fail if publicKey is invalid format', async () => {
      const dto = plainToClass(UploadUserKeyDto, { publicKey: 'invalid-key' });
      const errors = await validate(dto);

      const publicKeyError = errors.find(e => e.property === 'publicKey');
      expect(publicKeyError?.constraints?.isHederaPublicKey).toBe(ErrorCodes.IPK);
    });

    it('should pass and normalize valid publicKey', async () => {
      const dto = plainToClass(UploadUserKeyDto, { publicKey: validPublicKey });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.publicKey).toBe(normalizedPublicKey); // Should be normalized to raw format
    });
  });

  describe('conditional validation', () => {
    it('should require mnemonicHash when index is provided', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
        index: validIndex,
      });
      const errors = await validate(dto);

      const mnemonicError = errors.find(e => e.property === 'mnemonicHash');
      expect(mnemonicError).toBeDefined();
    });

    it('should require index when mnemonicHash is provided', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
        mnemonicHash: validMnemonicHash,
      });
      const errors = await validate(dto);

      const indexError = errors.find(e => e.property === 'index');
      expect(indexError).toBeDefined();
    });

    it('should pass with both mnemonicHash and index', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
        mnemonicHash: validMnemonicHash,
        index: validIndex,
      });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should pass with only publicKey', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
      });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('type validation', () => {
    it('should fail if mnemonicHash is not a string', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
        mnemonicHash: 123,
        index: validIndex,
      });
      const errors = await validate(dto);

      const mnemonicError = errors.find(e => e.property === 'mnemonicHash');
      expect(mnemonicError?.constraints?.isString).toBeDefined();
    });

    it('should fail if index is not a number', async () => {
      const dto = plainToClass(UploadUserKeyDto, {
        publicKey: validPublicKey,
        mnemonicHash: validMnemonicHash,
        index: 'not-a-number',
      });
      const errors = await validate(dto);

      const indexError = errors.find(e => e.property === 'index');
      expect(indexError?.constraints?.isNumber).toBeDefined();
    });
  });

  describe('integration: transform and validate', () => {
    it('should transform and validate successfully', async () => {
      const plain = {
        publicKey: validPublicKey,
        mnemonicHash: validMnemonicHash,
        index: validIndex,
      };

      const dto = plainToClass(UploadUserKeyDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.publicKey).toBe(normalizedPublicKey);
      expect(dto.mnemonicHash).toBe(validMnemonicHash);
      expect(dto.index).toBe(validIndex);
    });
  });
});