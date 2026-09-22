import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { Transaction, TransactionId, TransferTransaction } from '@hiero-ledger/sdk';
import ImportCSVController from '@renderer/pages/CreateTransactionGroup/ImportCSVController.vue';
import { DateTimeOptions } from '@renderer/composables/user/useDateTimeSetting.ts';
import { parseDateTime } from '@renderer/utils/parseDateTime.ts';

const mocks = vi.hoisted(() => ({
  getDateTimeSetting: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  lookup: vi.fn(),
  addGroupItem: vi.fn(),
  clearGroup: vi.fn(),
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

vi.mock('@renderer/utils/ToastManager.ts', () => ({
  ToastManager: { inject: () => ({ error: mocks.error, success: mocks.success }) },
}));
vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: { inject: () => ({ mirrorAccountById: { lookup: mocks.lookup } }) },
}));
vi.mock('@renderer/stores/storeTransactionGroup.ts', () => ({
  default: () => ({
    groupItems: [],
    addGroupItem: mocks.addGroupItem,
    clearGroup: mocks.clearGroup,
  }),
}));
vi.mock('@renderer/stores/storeNetwork.ts', () => ({ default: () => ({ mirrorNodeBaseURL: '' }) }));
vi.mock('@renderer/composables/useAccountId.ts', () => ({
  default: () => ({ key: { value: null } }),
}));
vi.mock('@renderer/utils', () => ({
  createLogger: () => ({ error: vi.fn() }),
  createTransactionId: (payer: string) => TransactionId.generate(payer),
}));

describe('ImportCSVController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDateTimeSetting.mockReset();
  });

  describe('parseDateTime', () => {
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

      test('rejects invalid date with invalid month', async () => {
        mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
        await expect(parseDateTime('13/15/26', '10:30')).rejects.toThrow(
          'Invalid date value: 13/15/26',
        );
      });

      test('rejects invalid date with invalid day of month', async () => {
        mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
        await expect(parseDateTime('02/30/26', '10:30')).rejects.toThrow(
          'Invalid date value: 02/30/26',
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

      test('rejects time with invalid hours', async () => {
        mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
        await expect(parseDateTime('01/15/26', '25:30')).rejects.toThrow('Invalid time value: 25:30');
      });

      test('rejects time with invalid minutes', async () => {
        mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
        await expect(parseDateTime('01/15/26', '10:60')).rejects.toThrow('Invalid time value: 10:60');
      });

      test('rejects time with invalid seconds', async () => {
        mocks.getDateTimeSetting.mockResolvedValue(DateTimeOptions.UTC_TIME);
        await expect(parseDateTime('01/15/26', '10:30:60')).rejects.toThrow('Invalid time value: 10:30:60');
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

  describe('payment amount validation', () => {
    async function importCsv(rows: string) {
      const callback = vi.fn();
      const wrapper = mount(ImportCSVController, {
        props: {
          activate: true,
          description: '',
          callback,
          selectedFile: new File(
            [`Sender account,0.0.100\nSending time,10:30Z\nAccountId,Amount,Date\n${rows}`],
            'payments.csv',
          ),
        },
        global: {
          stubs: {
            ActionController: {
              name: 'ActionController',
              props: ['actionCallback'],
              template: '<div />',
            },
          },
        },
      });
      await wrapper.findComponent({ name: 'ActionController' }).props('actionCallback')();
      expect(callback).toHaveBeenCalledOnce();
      expect(wrapper.emitted('update:activate')).toEqual([[false]]);
      wrapper.unmount();
    }

    test.each(['-1', '0', '-0', '1.5', '1e3', 'NaN', 'Infinity', '', '""', '"1,00"'])(
      'clears the group and stops importing when amount %s is invalid',
      async amount => {
        await importCsv(
          `0.0.200,1,01/01/2030\n0.0.201,${amount},01/01/2030\n0.0.202,2,01/01/2030`,
        );
        expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
          'Invalid amount on CSV line 5. Enter a positive number of tinybars.',
        );
        expect(mocks.addGroupItem).toHaveBeenCalledOnce();
        expect(mocks.clearGroup).toHaveBeenCalledOnce();
        expect(mocks.success).not.toHaveBeenCalled();
      },
    );

    test.each([
      ['1', '1'],
      ['"1,000"', '1000'],
      ['9007199254740993', '9007199254740993'],
      ['5000000000000000001', '5000000000000000001'],
    ])(
      'imports %s as a credit to the receiver and a debit to the sender',
      async (input, expected) => {
        await importCsv(`0.0.200,${input},01/01/2030`);
        expect(mocks.error).not.toHaveBeenCalled();
        expect(mocks.clearGroup).not.toHaveBeenCalled();
        expect(mocks.success).toHaveBeenCalledWith('Import complete');
        expect(mocks.addGroupItem).toHaveBeenCalledOnce();
        const transaction = Transaction.fromBytes(
          mocks.addGroupItem.mock.calls[0][0].transactionBytes,
        ) as TransferTransaction;
        const transfers = transaction.hbarTransfers;
        expect(transfers.get('0.0.200')!.toTinybars().toString()).toBe(expected);
        expect(transfers.get('0.0.100')!.toTinybars().toString()).toBe(`-${expected}`);
      },
    );
  });
});
