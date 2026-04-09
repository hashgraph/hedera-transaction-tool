import {
  generateTransactionExecutedContent,
  isSuccessStatusCode,
} from './transaction-executed';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  renderTransactionEmailLayout: jest.fn((title, body) => `<LAYOUT title="${title}">${body}</LAYOUT>`),
}));

jest.mock('@app/common/templates/index', () => ({
  getNetworkString: jest.fn((network: string) => {
    if (!network) return '';
    return network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  }),
}));

import { renderTransactionEmailLayout } from '@app/common/templates/layout';

const makeNotification = (overrides?: Partial<{
  transactionId: string;
  network: string;
  statusCode: unknown;
}>) =>
  ({
    additionalData: {
      transactionId: overrides?.transactionId ?? 'tx-123',
      network: overrides?.network ?? 'mainnet',
      statusCode: overrides?.statusCode ?? 22,
    },
  } as unknown as Notification);

describe('transaction-executed templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionExecutedContent()).toBe('');
    });

    it('does not call layout utilities when empty', () => {
      generateTransactionExecutedContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
    });
  });

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionExecutedContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transaction Executed',
        expect.any(String),
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateTransactionExecutedContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Transaction Executed">');
    });

    it('uses the unified CTA text', () => {
      const result = generateTransactionExecutedContent(makeNotification());
      expect(result).toContain('View details in the Hedera Transaction Tool');
    });
  });

  describe('isSuccessStatusCode', () => {
    it.each([0, 22, 104, '0', '22', '104'])('treats %p as success', (code) => {
      expect(isSuccessStatusCode(code)).toBe(true);
    });

    it.each([1, 999, '999', 'FAILED', '', undefined, null, NaN])('treats %p as failure', (code) => {
      expect(isSuccessStatusCode(code)).toBe(false);
    });

    it.each([true, false, [], [0], [22], {}, () => 22])(
      'treats non-numeric/string input %p as failure',
      (code) => {
        expect(isSuccessStatusCode(code as unknown)).toBe(false);
      },
    );

    it('treats numeric strings with non-digit characters as failure', () => {
      expect(isSuccessStatusCode(' 22')).toBe(false);
      expect(isSuccessStatusCode('22 ')).toBe(false);
      expect(isSuccessStatusCode('22.0')).toBe(false);
      expect(isSuccessStatusCode('-22')).toBe(false);
    });

    it('rejects numeric strings with leading zeros', () => {
      expect(isSuccessStatusCode('022')).toBe(false);
      expect(isSuccessStatusCode('00022')).toBe(false);
      expect(isSuccessStatusCode('0000000000')).toBe(false);
      expect(isSuccessStatusCode('0')).toBe(true);
    });
  });

  describe('all successful', () => {
    it('uses singular noun and bolded count for one successful notification', () => {
      const result = generateTransactionExecutedContent(makeNotification({ statusCode: 22 }));
      expect(result).toContain('<strong>1</strong> transaction executed successfully');
      expect(result).not.toContain('failed');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple successes', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 22 }),
        makeNotification({ statusCode: 0 }),
        makeNotification({ statusCode: 104 }),
      );
      expect(result).toContain('<strong>3</strong> transactions executed successfully');
      expect(result).not.toContain('failed');
    });
  });

  describe('all failed', () => {
    it('uses singular noun and bolded count for one failed notification', () => {
      const result = generateTransactionExecutedContent(makeNotification({ statusCode: 999 }));
      expect(result).toContain('<strong>1</strong> transaction failed to execute');
      expect(result).not.toContain('successfully');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple failures', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 999 }),
        makeNotification({ statusCode: 888 }),
      );
      expect(result).toContain('<strong>2</strong> transactions failed to execute');
      expect(result).not.toContain('successfully');
    });

    it('treats missing statusCode as failure', () => {
      const result = generateTransactionExecutedContent(
        { additionalData: {} } as unknown as Notification,
      );
      expect(result).toContain('<strong>1</strong> transaction failed to execute');
    });
  });

  describe('mixed success and failure', () => {
    it('renders both sentences with their own bolded counts', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 22 }),
        makeNotification({ statusCode: 22 }),
        makeNotification({ statusCode: 22 }),
        makeNotification({ statusCode: 999 }),
      );
      expect(result).toContain('<strong>3</strong> transactions executed successfully');
      expect(result).toContain('<strong>1</strong> transaction failed to execute');
    });

    it('disambiguates the 1 success + 1 failure case', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 22 }),
        makeNotification({ statusCode: 999 }),
      );
      expect(result).toContain('<strong>1</strong> transaction executed successfully');
      expect(result).toContain('<strong>1</strong> transaction failed to execute');
    });
  });

  describe('network breakdown', () => {
    it('renders a separate breakdown for success and failure sections', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 22, network: 'mainnet' }),
        makeNotification({ statusCode: 22, network: 'mainnet' }),
        makeNotification({ statusCode: 999, network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
      expect(result).toContain('<strong>1</strong> transaction on Testnet');
    });

    it('renders a multi-network breakdown within one section', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 22, network: 'mainnet' }),
        makeNotification({ statusCode: 22, network: 'testnet' }),
        makeNotification({ statusCode: 22, network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Testnet');
      expect(result).toContain('<strong>1</strong> transaction on Mainnet');
    });

    it('omits the breakdown paragraph for the success section when no network is present', () => {
      const notification = {
        additionalData: { statusCode: 22 },
      } as unknown as Notification;
      const result = generateTransactionExecutedContent(notification);
      expect(result).toContain('<strong>1</strong> transaction executed successfully');
      expect(result).not.toContain('on Mainnet');
      expect(result).not.toContain('on Testnet');
    });
  });

  describe('privacy', () => {
    it('does not embed transactionId', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ transactionId: '0.0.777@1234567890.000' }),
      );
      expect(result).not.toContain('0.0.777@1234567890.000');
    });

    it('does not embed raw statusCode digits', () => {
      const result = generateTransactionExecutedContent(
        makeNotification({ statusCode: 987654321 }),
      );
      expect(result).not.toContain('987654321');
    });
  });

  describe('robustness', () => {
    it('handles missing additionalData gracefully', () => {
      expect(() => generateTransactionExecutedContent({} as Notification)).not.toThrow();
    });
  });
});
