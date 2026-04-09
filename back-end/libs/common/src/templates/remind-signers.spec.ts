import { generateRemindSignersContent } from './remind-signers';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  emailWarning: jest.fn((msg) => `<WARNING:${msg}>`),
  renderTransactionEmailLayout: jest.fn((title, body) => `<LAYOUT title="${title}">${body}</LAYOUT>`),
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

describe('remind-signers templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateRemindSignersContent()).toBe('');
    });

    it('does not call any layout utilities when empty', () => {
      generateRemindSignersContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(emailWarning).not.toHaveBeenCalled();
    });
  });

  describe('high-level copy', () => {
    it('uses singular noun and bolded count for one notification', () => {
      const result = generateRemindSignersContent(makeNotification());
      expect(result).toContain('You still have <strong>1</strong> transaction waiting for your signature');
      expect(result).not.toContain('1 transactions');
    });

    it('uses plural noun and bolded count for multiple notifications', () => {
      const result = generateRemindSignersContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('You still have <strong>3</strong> transactions waiting for your signature');
    });

    it('uses the unified CTA text', () => {
      const result = generateRemindSignersContent(makeNotification());
      expect(result).toContain('View details in the Hedera Transaction Tool');
    });
  });

  describe('network breakdown', () => {
    it('renders a single-network breakdown', () => {
      const result = generateRemindSignersContent(
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'mainnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Mainnet');
    });

    it('renders a multi-network breakdown joined by comma', () => {
      const result = generateRemindSignersContent(
        makeNotification({ network: 'mainnet' }),
        makeNotification({ network: 'testnet' }),
        makeNotification({ network: 'testnet' }),
      );
      expect(result).toContain('<strong>2</strong> transactions on Testnet');
      expect(result).toContain('<strong>1</strong> transaction on Mainnet');
    });
  });

  describe('privacy', () => {
    it('does not embed the transactionId', () => {
      const result = generateRemindSignersContent(
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
      const result = generateRemindSignersContent(notification);
      expect(result).not.toContain('2099-12-31T23:59:59.000Z');
      expect(result).not.toContain('2099');
    });
  });

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with "Signature Reminder" as the title', () => {
      generateRemindSignersContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Signature Reminder',
        expect.any(String),
      );
    });

    it('calls emailWarning with the admin contact message', () => {
      generateRemindSignersContent(makeNotification());
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, please contact your administrator.",
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateRemindSignersContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Signature Reminder">');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() => generateRemindSignersContent({} as Notification)).not.toThrow();
    });
  });
});
