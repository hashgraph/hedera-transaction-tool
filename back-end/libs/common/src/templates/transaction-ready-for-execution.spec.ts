import { generateTransactionReadyForExecutionContent } from './transaction-ready-for-execution';
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
  isManual: boolean;
}>) =>
  ({
    additionalData: {
      transactionId: overrides?.transactionId ?? 'tx-123',
      network: overrides?.network ?? 'mainnet',
      isManual: overrides?.isManual ?? false,
    },
  } as unknown as Notification);

describe('transaction-ready-for-execution templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionReadyForExecutionContent()).toBe('');
    });

    it('does not call layout utilities when empty', () => {
      generateTransactionReadyForExecutionContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
    });
  });

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionReadyForExecutionContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transactions Ready for Execution',
        expect.any(String),
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Transactions Ready for Execution">');
    });

    it('uses the unified CTA text', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).toContain('View details in the Hedera Transaction Tool');
    });
  });

  describe('all automatic', () => {
    it('uses singular noun and bolded count for one notification', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).toContain('<strong>1</strong> transaction is ready and will be executed automatically');
      expect(result).not.toContain('manual submission');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('<strong>3</strong> transactions are ready and will be executed automatically');
      expect(result).not.toContain('manual submission');
    });
  });

  describe('all manual', () => {
    it('uses singular noun and bolded count for one notification', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
      );
      expect(result).toContain('<strong>1</strong> transaction requires manual submission');
      expect(result).not.toContain('automatically');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: true }),
      );
      expect(result).toContain('<strong>2</strong> transactions require manual submission');
      expect(result).not.toContain('automatically');
    });
  });

  describe('mixed manual and automatic', () => {
    it('renders both sentences with their own bolded counts', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: true }),
        makeNotification({ isManual: false }),
      );
      expect(result).toContain('<strong>2</strong> transactions require manual submission');
      expect(result).toContain('<strong>1</strong> transaction is ready and will be executed automatically');
    });

    it('disambiguates the 1 manual + 1 automatic case', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: false }),
      );
      expect(result).toContain('<strong>1</strong> transaction requires manual submission');
      expect(result).toContain('<strong>1</strong> transaction is ready and will be executed automatically');
    });
  });

  describe('network breakdown', () => {
    it('renders a separate breakdown per section', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true, network: 'mainnet' }),
        makeNotification({ isManual: true, network: 'mainnet' }),
        makeNotification({ isManual: false, network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
      expect(result).toContain('<strong>1</strong> transaction on Testnet');
    });

    it('renders a multi-network breakdown within a single section', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: false, network: 'mainnet' }),
        makeNotification({ isManual: false, network: 'mainnet' }),
        makeNotification({ isManual: false, network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
      expect(result).toContain('<strong>1</strong> transaction on Testnet');
    });

    it('omits the breakdown paragraph for the automatic section when no network is present', () => {
      const notification = {
        additionalData: { isManual: false },
      } as unknown as Notification;
      const result = generateTransactionReadyForExecutionContent(notification);
      expect(result).toContain('<strong>1</strong> transaction is ready and will be executed automatically');
      expect(result).not.toContain('on Mainnet');
      expect(result).not.toContain('on Testnet');
    });

    it('omits the breakdown paragraph for the manual section when no network is present', () => {
      const notification = {
        additionalData: { isManual: true },
      } as unknown as Notification;
      const result = generateTransactionReadyForExecutionContent(notification);
      expect(result).toContain('<strong>1</strong> transaction requires manual submission');
      expect(result).not.toContain('on Mainnet');
      expect(result).not.toContain('on Testnet');
    });
  });

  describe('privacy', () => {
    it('does not embed transactionId', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: '0.0.999@1234567890.000' }),
      );
      expect(result).not.toContain('0.0.999@1234567890.000');
    });

    it('does not embed validStart timestamps', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-1',
          network: 'mainnet',
          isManual: false,
          validStart: '2099-12-31T23:59:59.000Z',
        },
      } as unknown as Notification;
      const result = generateTransactionReadyForExecutionContent(notification);
      expect(result).not.toContain('2099-12-31T23:59:59.000Z');
      expect(result).not.toContain('2099');
    });
  });

  describe('robustness', () => {
    it('defaults isManual to false when not provided', () => {
      const notification = {
        additionalData: { transactionId: 'tx-1', network: 'mainnet' },
      } as unknown as Notification;
      const result = generateTransactionReadyForExecutionContent(notification);
      expect(result).toContain('<strong>1</strong> transaction is ready and will be executed automatically');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() =>
        generateTransactionReadyForExecutionContent({} as Notification),
      ).not.toThrow();
    });
  });
});
