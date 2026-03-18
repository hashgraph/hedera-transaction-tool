import { generateTransactionReadyForExecutionContent } from './transaction-ready-for-execution';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  buildEmailTransactionsList: jest.fn((transactions) =>
    `<TRANSACTIONS:${transactions.map((t: any) => `${t.transactionId}|${t.network}|${t.isManual}|${t.validStart}`).join(',')}>`
  ),
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
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

const makeNotification = (overrides?: Partial<{
  transactionId: string;
  network: string;
  isManual: boolean;
  validStart: string;
}>) =>
  ({
    additionalData: {
      transactionId: overrides?.transactionId ?? 'tx-123',
      network: overrides?.network ?? 'mainnet',
      isManual: overrides?.isManual ?? false,
      validStart: overrides?.validStart,
    },
  } as unknown as Notification);

describe('transaction-ready-for-execution templates', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

// ─── Empty input ──────────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionReadyForExecutionContent()).toBe('');
    });

    it('does not call layout utilities when empty', () => {
      generateTransactionReadyForExecutionContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
      expect(buildEmailTransactionsList).not.toHaveBeenCalled();
    });
  });

// ─── Layout wiring ────────────────────────────────────────────────────────────

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
  });

// ─── Intro copy — automatic only ─────────────────────────────────────────────

  describe('intro copy — all automatic', () => {
    it('uses singular automatic copy for one notification', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).toContain('A transaction is ready for execution');
      expect(result).not.toContain('Multiple transactions');
      expect(result).not.toContain('manual submission');
    });

    it('uses plural automatic copy for multiple notifications', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('Multiple transactions are ready for execution');
      expect(result).not.toContain('manual submission');
    });
  });

// ─── Intro copy — manual transactions present ─────────────────────────────────

  describe('intro copy — manual transactions present', () => {
    it('uses singular manual copy when one manual transaction', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
      );
      expect(result).toContain('This transaction requires manual submission');
      expect(result).not.toContain('Some transactions require');
    });

    it('uses plural manual copy when multiple transactions include a manual one', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: false }),
      );
      expect(result).toContain('Some transactions require manual submission');
      expect(result).not.toContain('This transaction requires');
    });

    it('uses plural manual copy when all transactions are manual', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: true }),
      );
      expect(result).toContain('Some transactions require manual submission');
    });
  });

// ─── Section rendering — automatic only ──────────────────────────────────────

  describe('automatic-only section', () => {
    it('renders "Ready for Automatic Execution" heading', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).toContain('Ready for Automatic Execution');
    });

    it('does not render "Manual Submission Required" heading', () => {
      const result = generateTransactionReadyForExecutionContent(makeNotification());
      expect(result).not.toContain('Manual Submission Required');
    });

    it('calls buildEmailTransactionsList once with automatic transactions', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'tx-auto', isManual: false }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledTimes(1);
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ transactionId: 'tx-auto', isManual: false })]),
      );
    });
  });

// ─── Section rendering — manual only ─────────────────────────────────────────

  describe('manual-only section', () => {
    it('renders "Manual Submission Required" heading', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
      );
      expect(result).toContain('Manual Submission Required');
    });

    it('does not render "Ready for Automatic Execution" heading', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
      );
      expect(result).not.toContain('Ready for Automatic Execution');
    });

    it('calls buildEmailTransactionsList once with manual transactions', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'tx-manual', isManual: true }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledTimes(1);
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ transactionId: 'tx-manual', isManual: true })]),
      );
    });
  });

// ─── Section rendering — mixed manual and automatic ──────────────────────────

  describe('mixed manual and automatic sections', () => {
    it('renders both section headings', () => {
      const result = generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'tx-manual', isManual: true }),
        makeNotification({ transactionId: 'tx-auto', isManual: false }),
      );
      expect(result).toContain('Manual Submission Required');
      expect(result).toContain('Ready for Automatic Execution');
    });

    it('calls buildEmailTransactionsList twice', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ isManual: true }),
        makeNotification({ isManual: false }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledTimes(2);
    });

    it('passes only manual transactions to the first buildEmailTransactionsList call', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'tx-manual', isManual: true }),
        makeNotification({ transactionId: 'tx-auto', isManual: false }),
      );
      const [firstCall, secondCall] = (buildEmailTransactionsList as jest.Mock).mock.calls;
      expect(firstCall[0].every((t: any) => t.isManual === true)).toBe(true);
      expect(secondCall[0].every((t: any) => t.isManual === false)).toBe(true);
    });

    it('does not mix manual and automatic in the same list', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'tx-manual', isManual: true }),
        makeNotification({ transactionId: 'tx-auto', isManual: false }),
      );
      const calls = (buildEmailTransactionsList as jest.Mock).mock.calls;
      calls.forEach(([transactions]) => {
        const isManualValues = transactions.map((t: any) => t.isManual);
        expect(new Set(isManualValues).size).toBe(1); // all same value
      });
    });
  });

// ─── Transaction data mapping ─────────────────────────────────────────────────

  describe('transaction data mapping', () => {
    it('passes network through getNetworkString', () => {
      generateTransactionReadyForExecutionContent(makeNotification({ network: 'testnet' }));
      expect(getNetworkString).toHaveBeenCalledWith('testnet');
    });

    it('defaults isManual to false when not provided', () => {
      const notification = {
        additionalData: { transactionId: 'tx-1', network: 'mainnet' },
      } as unknown as Notification;
      generateTransactionReadyForExecutionContent(notification);
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ isManual: false })]),
      );
    });

    it('preserves notification order within each section', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ transactionId: 'first', isManual: false }),
        makeNotification({ transactionId: 'second', isManual: false }),
        makeNotification({ transactionId: 'third', isManual: false }),
      );
      const [transactions] = (buildEmailTransactionsList as jest.Mock).mock.calls[0];
      expect(transactions[0].transactionId).toBe('first');
      expect(transactions[1].transactionId).toBe('second');
      expect(transactions[2].transactionId).toBe('third');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() =>
        generateTransactionReadyForExecutionContent({} as Notification)
      ).not.toThrow();
    });

    it('handles missing network', () => {
      const notification = { additionalData: { transactionId: 'tx-1' } } as unknown as Notification;
      generateTransactionReadyForExecutionContent(notification);
      expect(getNetworkString).toHaveBeenCalledWith(undefined);
    });

    it('passes validStart to buildEmailTransactionsList when provided', () => {
      generateTransactionReadyForExecutionContent(
        makeNotification({ validStart: '2024-01-15T10:30:45Z' }),
      );
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ validStart: '2024-01-15T10:30:45Z' }),
        ]),
      );
    });

    it('passes undefined validStart when not provided', () => {
      generateTransactionReadyForExecutionContent(makeNotification());
      expect(buildEmailTransactionsList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ validStart: undefined }),
        ]),
      );
    });
  });
});
