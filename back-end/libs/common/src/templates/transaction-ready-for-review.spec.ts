import { generateTransactionReadyForReviewContent } from './transaction-ready-for-review';
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

describe('transaction-ready-for-review templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionReadyForReviewContent()).toBe('');
    });

    it('does not call any layout utilities when empty', () => {
      generateTransactionReadyForReviewContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(emailWarning).not.toHaveBeenCalled();
    });
  });

  describe('high-level copy', () => {
    it('uses singular noun for one notification', () => {
      const result = generateTransactionReadyForReviewContent(makeNotification());
      expect(result).toContain('You have <strong>1</strong> transaction waiting for your review');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun for multiple notifications', () => {
      const result = generateTransactionReadyForReviewContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('You have <strong>3</strong> transactions waiting for your review');
    });

    it('includes the CTA text', () => {
      const result = generateTransactionReadyForReviewContent(makeNotification());
      expect(result).toContain('View details in the Hedera Transaction Tool');
    });
  });

  describe('network breakdown', () => {
    it('renders a single-network breakdown', () => {
      const result = generateTransactionReadyForReviewContent(
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'mainnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
    });

    it('renders a multi-network breakdown joined by comma', () => {
      const result = generateTransactionReadyForReviewContent(
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
      expect(result).toContain('<strong>1</strong> transaction on Testnet');
    });
  });

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionReadyForReviewContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transaction Review Request',
        expect.any(String),
      );
    });

    it('calls emailWarning with the admin contact message', () => {
      generateTransactionReadyForReviewContent(makeNotification());
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, please contact your administrator.",
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateTransactionReadyForReviewContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Transaction Review Request">');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() =>
        generateTransactionReadyForReviewContent({} as Notification),
      ).not.toThrow();
    });
  });
});
