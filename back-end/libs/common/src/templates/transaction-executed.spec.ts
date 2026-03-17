import { generateTransactionExecutedContent, emailExecutedTransactionList } from './transaction-executed';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  emailCardRow: jest.fn((cells, index) => `<ROW index="${index}">${cells}</ROW>`),
  emailCardTable: jest.fn((rows) => `<TABLE>${rows}</TABLE>`),
  escapeHtml: jest.fn((str) => str),
  renderTransactionEmailLayout: jest.fn((title, body) => `<LAYOUT title="${title}">${body}</LAYOUT>`),
}));

jest.mock('@app/common/templates/index', () => ({
  getNetworkString: jest.fn((network: string) => {
    if (!network) return '';
    return network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  }),
}));

import {
  emailCardRow,
  emailCardTable,
  escapeHtml,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

const makeNotification = (overrides?: Partial<{
  transactionId: string;
  network: string;
  statusCode: any;
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

// ─── Empty input ──────────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty string when called with no arguments', () => {
      expect(generateTransactionExecutedContent()).toBe('');
    });

    it('does not call layout utilities when empty', () => {
      generateTransactionExecutedContent();
      expect(renderTransactionEmailLayout).not.toHaveBeenCalled();
    });
  });

// ─── Singular vs plural copy ──────────────────────────────────────────────────

  describe('singular vs plural intro text', () => {
    it('uses singular copy for one notification', () => {
      const result = generateTransactionExecutedContent(makeNotification());
      expect(result).toContain('A transaction has completed');
      expect(result).not.toContain('Multiple transactions');
    });

    it('uses plural copy for two notifications', () => {
      const result = generateTransactionExecutedContent(makeNotification(), makeNotification());
      expect(result).toContain('Multiple transactions have completed');
      expect(result).not.toContain('A transaction has completed');
    });

    it('uses plural copy for three or more notifications', () => {
      const result = generateTransactionExecutedContent(
        makeNotification(),
        makeNotification(),
        makeNotification(),
      );
      expect(result).toContain('Multiple transactions have completed');
    });
  });

// ─── Layout wiring ────────────────────────────────────────────────────────────

  describe('layout integration', () => {
    it('calls renderTransactionEmailLayout with correct title', () => {
      generateTransactionExecutedContent(makeNotification());
      expect(renderTransactionEmailLayout).toHaveBeenCalledWith(
        'Transaction Execution Results',
        expect.any(String),
      );
    });

    it('returns the output of renderTransactionEmailLayout', () => {
      const result = generateTransactionExecutedContent(makeNotification());
      expect(result).toContain('<LAYOUT title="Transaction Execution Results">');
    });
  });

// ─── Transaction data mapping ─────────────────────────────────────────────────

  describe('transaction data mapping', () => {
    it('passes network through getNetworkString', () => {
      generateTransactionExecutedContent(makeNotification({ network: 'testnet' }));
      expect(getNetworkString).toHaveBeenCalledWith('testnet');
    });

    it('handles missing additionalData gracefully', () => {
      expect(() => generateTransactionExecutedContent({} as Notification)).not.toThrow();
    });
  });

// ─── emailExecutedTransactionList ────────────────────────────────────────────

  describe('emailExecutedTransactionList', () => {
    it('wraps output in a card table', () => {
      const result = emailExecutedTransactionList([{ transactionId: 'tx-1', network: 'Mainnet', statusCode: '22' }]);
      expect(emailCardTable).toHaveBeenCalledTimes(1);
      expect(result).toContain('<TABLE>');
    });

    it('calls emailCardRow for each transaction', () => {
      emailExecutedTransactionList([
        { transactionId: 'tx-1', network: 'Mainnet', statusCode: '22' },
        { transactionId: 'tx-2', network: 'Testnet', statusCode: '999' },
      ]);
      expect(emailCardRow).toHaveBeenCalledTimes(2);
    });

    it('passes row index to emailCardRow', () => {
      emailExecutedTransactionList([
        { transactionId: 'tx-1', network: 'Mainnet', statusCode: '22' },
        { transactionId: 'tx-2', network: 'Testnet', statusCode: '22' },
      ]);
      expect((emailCardRow as jest.Mock).mock.calls[0][1]).toBe(0);
      expect((emailCardRow as jest.Mock).mock.calls[1][1]).toBe(1);
    });

    it('escapes transactionId', () => {
      emailExecutedTransactionList([{ transactionId: '<b>xss</b>', network: 'Mainnet', statusCode: '22' }]);
      expect(escapeHtml).toHaveBeenCalledWith('<b>xss</b>');
    });

    it('escapes network', () => {
      emailExecutedTransactionList([{ transactionId: 'tx-1', network: '<b>bad</b>', statusCode: '22' }]);
      expect(escapeHtml).toHaveBeenCalledWith('<b>bad</b>');
    });

    it('uses "UNKNOWN" as status when statusCode is undefined', () => {
      emailExecutedTransactionList([{ transactionId: 'tx-1', network: 'Mainnet' }]);
      expect(escapeHtml).toHaveBeenCalledWith('UNKNOWN');
    });

    it('handles empty transaction list', () => {
      const result = emailExecutedTransactionList([]);
      expect(emailCardTable).toHaveBeenCalledWith('');
      expect(result).toContain('<TABLE>');
    });

    describe('status badge styles', () => {
      const successCodes = ['0', '22', '104'];
      successCodes.forEach(code => {
        it(`applies success styles for statusCode "${code}"`, () => {
          emailExecutedTransactionList([{ transactionId: 'tx', network: 'Mainnet', statusCode: code }]);
          const cellsArg = (emailCardRow as jest.Mock).mock.calls[0][0];
          expect(cellsArg).toContain('#2eb85c'); // success color
          expect(cellsArg).not.toContain('#dc3545');
        });
      });

      it('applies failure styles for an unrecognized numeric statusCode', () => {
        emailExecutedTransactionList([{ transactionId: 'tx', network: 'Mainnet', statusCode: '999' }]);
        const cellsArg = (emailCardRow as jest.Mock).mock.calls[0][0];
        expect(cellsArg).toContain('#dc3545'); // failure color
        expect(cellsArg).not.toContain('#2eb85c');
      });

      it('applies failure styles when statusCode is a non-numeric string', () => {
        emailExecutedTransactionList([{ transactionId: 'tx', network: 'Mainnet', statusCode: 'FAILED' }]);
        const cellsArg = (emailCardRow as jest.Mock).mock.calls[0][0];
        expect(cellsArg).toContain('#dc3545');
      });

      it('applies failure styles when statusCode is "UNKNOWN"', () => {
        emailExecutedTransactionList([{ transactionId: 'tx', network: 'Mainnet' }]);
        const cellsArg = (emailCardRow as jest.Mock).mock.calls[0][0];
        expect(cellsArg).toContain('#dc3545');
      });
    });
  });
});
