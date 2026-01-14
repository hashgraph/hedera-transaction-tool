import { plainToClass } from 'class-transformer';
import { NormalizePublicKey } from './normalize-public-key.transform';

class TestDto {
  @NormalizePublicKey()
  publicKey: string;
}

describe('NormalizePublicKey', () => {
  const validRawKey = 'e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';
  const validDerKey = '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';

  it('should normalize a valid public key to raw format', () => {
    const plain = { publicKey: validDerKey };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBe(validRawKey);
  });

  it('should keep already normalized key unchanged', () => {
    const plain = { publicKey: validRawKey };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBe(validRawKey);
  });

  it('should return value unchanged if PublicKey.fromString throws', () => {
    const invalidKey = 'invalid-key';
    const plain = { publicKey: invalidKey };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBe(invalidKey);
  });

  it('should return undefined if value is undefined', () => {
    const plain = { publicKey: undefined };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBeUndefined();
  });

  it('should return null if value is null', () => {
    const plain = { publicKey: null };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBeNull();
  });

  it('should return empty string if value is empty string', () => {
    const plain = { publicKey: '' };
    const transformed = plainToClass(TestDto, plain);

    expect(transformed.publicKey).toBe('');
  });
});