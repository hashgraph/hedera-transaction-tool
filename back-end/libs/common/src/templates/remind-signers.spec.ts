import { generateRemindSignersContent } from './remind-signers';
import { Notification } from '@entities';

// Mock layout utilities so tests focus on content logic, not HTML rendering details
jest.mock('@app/common/templates/layout', () => ({
  buildEmailTransactionsList: jest.fn((transactions) =>
    `<TRANSACTIONS:${transactions.map((t: any) => `${t.transactionId}|${t.network}`).join(',')}>`
  ),
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
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

const makeNotification = (overrides?: Partial<{
  transactionId: string;
  network: string;
}>) =>
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

// ─── Empty input ──────────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      const result = generateRemindSignersContent();
      expect(result).toBe('');
    });

    it('does not call any layout utilities when empty', () => {
      generateRemindSignersContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(buildEmailTransactionsList).not.toHaveBeenCalled();
    });
  });

// ─── Singular vs plural copy ──────────────────────────────────────────────────

  describe('singular vs plural intro text', () => {
    it('uses singular copy for one notification', () => {
      const result = generateRemindSignersContent(makeNotification());
      expect(result).toContain('The following transaction is still waiting');
      expect(result).not.toContain('transactions are');
    });

    it('uses plural copy for two notifications', () => {
      const result = generateRemindSignersContent(makeNotification(), makeNotification());
      expect(result).toContain('The following transactions are still waiting');
      expect(result).not.toContain('transaction is still');
    });

    it('uses plural copy for three or more notifications', () => {
      const result = generateRemindSignersContent(
        makeNotification(),
        makeNotification(),
        makeNotification()
      );
      expect(result).toContain('The following transactions are still waiting');
    });
  });

// ─── Layout wiring ────────────────────────────────────────────────────────────

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with "Signature Reminder" as the title', () => {
      generateRemindSignersContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Signature Reminder',
        expect.any(String)
      );
    });

    it('calls buildEmailTransactionsList once', () => {
      generateRemindSignersContent(makeNotification());
      expect(buildEmailTransactionsList).toHaveBeenCalledTimes(1);
    });

    it('calls emailWarning with the admin contact message', () => {
      generateRemindSignersContent(makeNotification());
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, please contact your administrator."
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateRemindSignersContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Signature Reminder">');
    });
  });

// ─── Transaction data passed to buildEmailTransactionsList ───────────────────

  describe('transaction data mapping', () => {
    it('passes transactionId to buildEmailTransactionsList', () => {
      generateRemindSignersContent(makeNotification({ transactionId: '0.0.999@1234567890.000' }));
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transactionId: '0.0.999@1234567890.000' }),
        ])
      );
    });

    it('passes network through getNetworkString', () => {
      generateRemindSignersContent(makeNotification({ network: 'testnet' }));
      expect(getNetworkString).toHaveBeenCalledWith('testnet');
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ network: 'Testnet' }),
        ])
      );
    });

    it('passes all notifications to buildEmailTransactionsList', () => {
      generateRemindSignersContent(
        makeNotification({ transactionId: 'tx-1', network: 'mainnet' }),
        makeNotification({ transactionId: 'tx-2', network: 'testnet' }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledWith([
        { transactionId: 'tx-1', network: 'Mainnet' },
        { transactionId: 'tx-2', network: 'Testnet' },
      ]);
    });

    it('handles missing additionalData gracefully', () => {
      const notification = {} as Notification;
      expect(() => generateRemindSignersContent(notification)).not.toThrow();
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transactionId: undefined }),
        ])
      );
    });

    it('handles missing transactionId', () => {
      const notification = { additionalData: { network: 'mainnet' } } as unknown as Notification;
      generateRemindSignersContent(notification);
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transactionId: undefined }),
        ])
      );
    });

    it('handles missing network', () => {
      const notification = { additionalData: { transactionId: 'tx-1' } } as unknown as Notification;
      generateRemindSignersContent(notification);
      expect(getNetworkString).toHaveBeenCalledWith(undefined);
    });
  });
});
