import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DateTimeOptions } from '@renderer/composables/user/useDateTimeSetting.ts';
import { parseDateTime } from '@renderer/utils/parseDateTime.ts';

const mocks = vi.hoisted(() => ({
  getDateTimeSetting: vi.fn(),
}));

vi.mock('@renderer/composables/user/useDateTimeSetting.ts', () => ({
  default: () => ({
    getDateTimeSetting: () => mocks.getDateTimeSetting(),
  }),
  DateTimeOptions: {
    UTC_TIME: 'utc-time',
    LOCAL_TIME: 'local-time',
  },
}));

describe('ImportCSVController - parseDateTime', () => {
  beforeEach(() => {
    mocks.getDateTimeSetting.mockReset();
  });

  describe('Date parsing', () => {
    test('parses 2-digit year format MM/DD/YY', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '10:30');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(15);
    });

    test('parses 4-digit year format MM/DD/YYYY', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/2027', '10:30');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(15);
    });

    test('parses single-digit month and day M/D/YY', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('4/5/27', '10:30');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(3); // April
      expect(result.getUTCDate()).toBe(5);
    });

    test('rejects invalid date with wrong separator', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      await expect(parseDateTime('01-15-26', '10:30')).rejects.toThrow(
        'Invalid date format: 01-15-26',
      );
    });

    test('rejects invalid date with 1-digit year', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      await expect(parseDateTime('01/15/6', '10:30')).rejects.toThrow(
        'Invalid date format: 01/15/6',
      );
    });

    test('rejects empty date components', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      await expect(parseDateTime('//26', '10:30')).rejects.toThrow('Invalid date format: //26');
    });
  });

  describe('Time parsing', () => {
    test('parses time without seconds HH:MM', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '14:30');
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(0);
    });

    test('parses time with seconds HH:MM:SS', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '14:30:45');
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(45);
    });

    test('parses time with single digit parts H:M:S', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '5:9:3');
      expect(result.getUTCHours()).toBe(5);
      expect(result.getUTCMinutes()).toBe(9);
      expect(result.getUTCSeconds()).toBe(3);
    });

    test('handles midnight 0:0:0', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '0:0:0');
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });

    test('handles end of day 23:59:59', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '23:59:59');
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
    });

    test('rejects empty time components', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      await expect(parseDateTime('01/15/26', '::30')).rejects.toThrow('Invalid time format: ::30');
    });
  });

  describe('Time parsing with timezone offset', () => {
    test('parses time with Z suffix H:M:SZ', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('01/15/27', '5:9:3Z');
      expect(result.getUTCHours()).toBe(5);
      expect(result.getUTCMinutes()).toBe(9);
      expect(result.getUTCSeconds()).toBe(3);

      expect(mocks.getDateTimeSetting).not.toHaveBeenCalled();
    });

    test('parses time with positive offset HH:MM:SS+HH:MM', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('01/15/27', '21:30:45+05:30');
      expect(result.getUTCHours()).toBe(16);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(45);

      expect(mocks.getDateTimeSetting).not.toHaveBeenCalled();
    });

    test('parses time with negative offset HH:MM-HH:MM', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('01/15/27', '21:30-06:00');
      expect(result.getUTCHours()).toBe(3);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(0);

      expect(mocks.getDateTimeSetting).not.toHaveBeenCalled();
    });
  });

  describe('Real-world scenarios', () => {
    test('uses UTC_TIME setting when no offset provided', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
      const result = await parseDateTime('01/15/27', '14:30');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });

    test('uses LOCAL_TIME setting when no offset provided', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('3/15/27', '14:30');
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    test('interpret as UTC when Z offset provided, ignoring the settings', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('03/15/27', '14:30Z');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });

    test('apply specified offset, ignoring the settings', async () => {
      mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.LOCAL_TIME);
      const result = await parseDateTime('03/15/27', '14:30+02:00');
      expect(result.getUTCFullYear()).toBe(2027);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });
});
