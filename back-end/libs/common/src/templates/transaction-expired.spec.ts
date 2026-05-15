import { generateTransactionExpiredContent } from '@app/common/templates/transaction-expired';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  emailWarning: jest.fn((msg) => `<WARNING:${msg}>`),
  renderTransactionEmailLayout: jest.fn((title, body) => `<LAYOUT title="${title}">${body}</LAYOUT>`),
  escapeHtml: jest.requireActual('@app/common/templates/layout').escapeHtml,
}));

jest.mock('@app/common/templates/index', () => ({
  getNetworkString: jest.fn((network: string) => {
    if (!network) return '';
    return network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  }),
}));

import {
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';

const makeNotification = (overrides?: Partial<{ transactionId: string; network: string }>) =>
  ({
    additionalData: {
      transactionId: overrides?.transactionId ?? 'tx-123',
      network: overrides?.network ?? 'mainnet',
    },
  } as unknown as Notification);

describe('transaction-expired templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionExpiredContent()).toBe('');
    });

    it('does not call any layout utilities when empty', () => {
      generateTransactionExpiredContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(emailWarning).not.toHaveBeenCalled();
    });
  });

  describe('high-level copy', () => {
    it('uses singular noun and bolded count for one notification', () => {
      const result = generateTransactionExpiredContent(makeNotification());
      expect(result).toContain('<strong>1</strong> transaction has expired');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple notifications', () => {
      const result = generateTransactionExpiredContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('<strong>3</strong> transactions have expired');
    });

    it('uses the unified CTA text', () => {
      const result = generateTransactionExpiredContent(makeNotification());
      expect(result).toContain('View details in the Hedera Transaction Tool');
    });
  });

  describe('network breakdown', () => {
    it('renders a single-network breakdown', () => {
      const result = generateTransactionExpiredContent(
        makeNotification({ network: 'testnet' }),
      );
      expect(result).toContain('<strong>1</strong> transaction on Testnet');
    });

    it('renders a multi-network breakdown', () => {
      const result = generateTransactionExpiredContent(
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'testnet' }),
        makeNotification({ network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Testnet');
      expect(result).toContain('<strong>1</strong> transaction on Mainnet');
    });
  });

  describe('privacy', () => {
    it('does not embed transactionId', () => {
      const result = generateTransactionExpiredContent(
        makeNotification({ transactionId: '0.0.999@1234567890.000' }),
      );
      expect(result).not.toContain('0.0.999@1234567890.000');
    });

    it('does not embed validStart timestamps', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-1',
          network: 'mainnet',
          validStart: '2099-12-31T23:59:59.000Z',
        },
      } as unknown as Notification;
      const result = generateTransactionExpiredContent(notification);
      expect(result).not.toContain('2099-12-31T23:59:59.000Z');
      expect(result).not.toContain('2099');
    });
  });

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionExpiredContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transaction Expired',
        expect.any(String),
      );
    });

    it('calls emailWarning with the admin contact message', () => {
      generateTransactionExpiredContent(makeNotification());
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, please contact your administrator.",
      );
    });

    it('handles missing additionalData gracefully', () => {
      expect(() => generateTransactionExpiredContent({} as Notification)).not.toThrow();
    });
  });
});
