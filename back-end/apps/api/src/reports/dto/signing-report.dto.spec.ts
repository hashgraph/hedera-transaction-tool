import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { SigningReportQueryDto, SigningReportType } from './signing-report.dto';

function toDto(plain: Record<string, unknown>): SigningReportQueryDto {
  return plainToInstance(SigningReportQueryDto, plain);
}

describe('SigningReportQueryDto', () => {
  const base = { type: SigningReportType.ACCOUNT, id: '0.0.100', mirrorNetwork: 'testnet' };

  describe('completedOnly coercion', () => {
    it.each([
      ['true', true],
      [true, true],
      ['false', false],
      [false, false],
    ])('coerces %p to %p', (input, expected) => {
      const dto = toDto({ ...base, completedOnly: input });
      expect(dto.completedOnly).toBe(expected);
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('defaults to true when omitted', () => {
      const dto = toDto({ ...base });
      expect(dto.completedOnly).toBe(true);
    });

    it.each(['0', 'no', 'off', ''])('rejects the non-boolean token %p', token => {
      const dto = toDto({ ...base, completedOnly: token });
      const errors = validateSync(dto);
      expect(errors.some(e => e.property === 'completedOnly')).toBe(true);
    });
  });

  describe('date coercion', () => {
    it('parses startDate and endDate strings into Date instances', () => {
      const dto = toDto({ ...base, startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-02' });
      expect(dto.startDate).toBeInstanceOf(Date);
      expect(dto.endDate).toBeInstanceOf(Date);
      expect(dto.startDate?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects an invalid date', () => {
      const dto = toDto({ ...base, startDate: 'not-a-date' });
      expect(validateSync(dto).some(e => e.property === 'startDate')).toBe(true);
    });
  });

  describe('required fields', () => {
    it('rejects a missing/empty id', () => {
      expect(validateSync(toDto({ type: SigningReportType.ACCOUNT })).some(e => e.property === 'id')).toBe(
        true,
      );
    });

    it('rejects an invalid type', () => {
      expect(
        validateSync(toDto({ ...base, type: 'bogus' })).some(e => e.property === 'type'),
      ).toBe(true);
    });
  });
});
