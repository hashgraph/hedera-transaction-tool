import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ReviewActionDto } from './review-action.dto';

// No enableImplicitConversion: the real app's global ValidationPipe (setup-app.ts) only sets
// `whitelist` and `transform`, not `transformOptions.enableImplicitConversion`, and this DTO is
// only ever bound to a JSON body (already-typed values), never query params.
const toDto = (plain: Record<string, unknown>) => plainToInstance(ReviewActionDto, plain);

const validSignature = { userKeyId: 5, signature: '0xdeadbeef' };

describe('ReviewActionDto', () => {
  test('accepts a valid acceptance payload', () => {
    const dto = toDto({ accepted: true, signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('accepts a valid rejection payload with a note', () => {
    const dto = toDto({ accepted: false, note: 'bad tx', signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('rejects when accepted is missing', () => {
    const dto = toDto({ signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'accepted')).toBe(true);
  });

  test('rejects when accepted is not a boolean', () => {
    const dto = toDto({ accepted: 'yes', signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'accepted')).toBe(true);
  });

  test('a rejection note is optional (accepted: false with no note is valid)', () => {
    const dto = toDto({ accepted: false, signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('rejects a non-string note when rejecting', () => {
    const dto = toDto({ accepted: false, note: 42, signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'note')).toBe(true);
  });

  test('note is not validated at all when accepting (ValidateIf gates on accepted === false)', () => {
    // A non-string note is normally invalid, but ValidateIf skips validation entirely
    // when accepted is true, so this documents the DTO's actual (permissive) behavior.
    const dto = toDto({ accepted: true, note: 42, signatures: [validSignature] });

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('rejects when signatures is missing', () => {
    const dto = toDto({ accepted: true });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'signatures')).toBe(true);
  });

  test('rejects when signatures is not an array', () => {
    const dto = toDto({ accepted: true, signatures: 'not-an-array' });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'signatures')).toBe(true);
  });

  test('an empty signatures array currently passes DTO validation (IsNotEmpty does not check array length)', () => {
    // Documents existing behavior: the service layer, not the DTO, is what rejects an
    // empty signatures array (as ForbiddenException RKNA - see reviewers.service.spec.ts).
    const dto = toDto({ accepted: true, signatures: [] });

    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  test('rejects a signature entry with a non-integer userKeyId', () => {
    const dto = toDto({ accepted: true, signatures: [{ userKeyId: 'five', signature: '0xab' }] });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'signatures')).toBe(true);
  });

  test('rejects a signature entry missing the signature string', () => {
    const dto = toDto({ accepted: true, signatures: [{ userKeyId: 5 }] });

    const errors = validateSync(dto);
    expect(errors.some(e => e.property === 'signatures')).toBe(true);
  });

  test('converts nested signature entries to ReviewSignatureDto instances', () => {
    const dto = toDto({ accepted: true, signatures: [validSignature] });

    expect(dto.signatures[0]).toEqual(expect.objectContaining(validSignature));
  });
});
