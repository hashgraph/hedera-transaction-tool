import { validate } from 'class-validator';
import { IsHederaPublicKey, IsHederaPublicKeyConstraint } from './is-hedera-public-key.validator';
import { ErrorCodes } from '@app/common';

class TestDto {
  @IsHederaPublicKey()
  publicKey: string;
}

describe('IsHederaPublicKeyConstraint', () => {
  let constraint: IsHederaPublicKeyConstraint;

  beforeEach(() => {
    constraint = new IsHederaPublicKeyConstraint();
  });

  describe('validate', () => {
    it('should return true for valid public key', () => {
      const validKey = '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';
      expect(constraint.validate(validKey)).toBe(true);
    });

    it('should return false for invalid public key format', () => {
      expect(constraint.validate('invalid-key')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(constraint.validate(123)).toBe(false);
      expect(constraint.validate(null)).toBe(false);
      expect(constraint.validate(undefined)).toBe(false);
      expect(constraint.validate({})).toBe(false);
      expect(constraint.validate([])).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(constraint.validate('')).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return the custom error code', () => {
      expect(constraint.defaultMessage()).toBe(ErrorCodes.IPK);
    });
  });
});

describe('IsHederaPublicKey decorator', () => {
  it('should fail validation for invalid public key', async () => {
    const dto = new TestDto();
    dto.publicKey = 'invalid-key';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('publicKey');
    expect(errors[0].constraints?.isHederaPublicKey).toBe(ErrorCodes.IPK);
  });

  it('should pass validation for valid public key', async () => {
    const dto = new TestDto();
    dto.publicKey = '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should allow custom validation message', async () => {
    class CustomMessageDto {
      @IsHederaPublicKey({ message: 'Custom error message' })
      publicKey: string;
    }

    const dto = new CustomMessageDto();
    dto.publicKey = 'invalid';

    const errors = await validate(dto);

    expect(errors[0].constraints?.isHederaPublicKey).toBe('Custom error message');
  });
});