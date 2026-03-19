import { generateTransactionWaitingForSignaturesContent } from './transaction-waiting-for-signatures';
import { Notification } from '@entities';

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

const makeNotification = (overrides?: Partial<{ transactionId: string; network: string }>) =>
  ({
    additionalData: {
      transactionId: overrides?.transactionId ?? 'tx-123',
      network: overrides?.network ?? 'mainnet',
    },
  } as unknown as Notification);


describe('transaction-waiting-for-signatures templates', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

// ─── Empty input ──────────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionWaitingForSignaturesContent()).toBe('');
    });

    it('does not call any layout utilities when empty', () => {
      generateTransactionWaitingForSignaturesContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(buildEmailTransactionsList).not.toHaveBeenCalled();
    });
  });

// ─── Singular vs plural copy ──────────────────────────────────────────────────

  describe('singular vs plural intro text', () => {
    it('uses singular copy for one notification', () => {
      const result = generateTransactionWaitingForSignaturesContent(makeNotification());
      expect(result).toContain('A new transaction requires your review and signature');
      expect(result).not.toContain('Multiple transactions');
    });

    it('uses plural copy for two notifications', () => {
      const result = generateTransactionWaitingForSignaturesContent(
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('Multiple transactions require your review and signature');
      expect(result).not.toContain('A new transaction requires');
    });

    it('uses plural copy for three or more notifications', () => {
      const result = generateTransactionWaitingForSignaturesContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('Multiple transactions require your review and signature');
    });
  });

// ─── Layout wiring ────────────────────────────────────────────────────────────

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionWaitingForSignaturesContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transaction Signature Request',
        expect.any(String),
      );
    });

    it('calls buildEmailTransactionsList once', () => {
      generateTransactionWaitingForSignaturesContent(makeNotification());
      expect(buildEmailTransactionsList).toHaveBeenCalledTimes(1);
    });

    it('calls emailWarning with the admin contact message', () => {
      generateTransactionWaitingForSignaturesContent(makeNotification());
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, please contact your administrator.",
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateTransactionWaitingForSignaturesContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Transaction Signature Request">');
    });
  });

// ─── Transaction data mapping ─────────────────────────────────────────────────

  describe('transaction data mapping', () => {
    it('passes transactionId to buildEmailTransactionsList', () => {
      generateTransactionWaitingForSignaturesContent(
        makeNotification({ transactionId: '0.0.999@1234567890.000' }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transactionId: '0.0.999@1234567890.000' }),
        ]),
      );
    });

    it('passes network through getNetworkString', () => {
      generateTransactionWaitingForSignaturesContent(makeNotification({ network: 'testnet' }));
      expect(getNetworkString).toHaveBeenCalledWith('testnet');
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ network: 'Testnet' })]),
      );
    });

    it('passes all notifications to buildEmailTransactionsList', () => {
      generateTransactionWaitingForSignaturesContent(
        makeNotification({ transactionId: 'tx-1', network: 'mainnet' }),
        makeNotification({ transactionId: 'tx-2', network: 'testnet' }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledWith([
        { transactionId: 'tx-1', network: 'Mainnet' },
        { transactionId: 'tx-2', network: 'Testnet' },
      ]);
    });

    it('preserves notification order', () => {
      generateTransactionWaitingForSignaturesContent(
        makeNotification({ transactionId: 'first' }),
        makeNotification({ transactionId: 'second' }),
        makeNotification({ transactionId: 'third' }),
      );
      const [transactions] = (buildEmailTransactionsList as jest.Mock).mock.calls[0];
      expect(transactions[0].transactionId).toBe('first');
      expect(transactions[1].transactionId).toBe('second');
      expect(transactions[2].transactionId).toBe('third');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() =>
        generateTransactionWaitingForSignaturesContent({} as Notification),
      ).not.toThrow();
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ transactionId: undefined })]),
      );
    });

    it('handles missing transactionId', () => {
      const notification = { additionalData: { network: 'mainnet' } } as unknown as Notification;
      generateTransactionWaitingForSignaturesContent(notification);
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ transactionId: undefined })]),
      );
    });

    it('handles missing network', () => {
      const notification = { additionalData: { transactionId: 'tx-1' } } as unknown as Notification;
      generateTransactionWaitingForSignaturesContent(notification);
      expect(getNetworkString).toHaveBeenCalledWith(undefined);
    });
  });
});
