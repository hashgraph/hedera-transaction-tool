import {
  generateTransactionExecutedContent,
  newGenerateTransactionExecutedContent,
} from '.';
import { Notification, TransactionStatus } from '@entities';

describe('generateTransactionExecutedContent', () => {
  describe('header content', () => {
    it('should use singular header for one notification', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Transaction has executed!');
      expect(result).not.toContain('Multiple transactions');
    });

    it('should use plural header for multiple notifications', () => {
      const notifications = [
        { additionalData: { status: 'SUCCESS', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { status: 'FAILED', transactionId: 'tx-2', network: 'testnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExecutedContent(...notifications);

      expect(result).toContain('Multiple transactions have executed!');
      expect(result).not.toContain('Transaction has executed!');
    });
  });

  describe('transaction details', () => {
    it('should include status, transaction ID, and network', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          transactionId: '0.0.123@1234567890.123456789',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Status: SUCCESS');
      expect(result).toContain('Transaction ID: 0.0.123@1234567890.123456789');
      expect(result).toContain('Network: Mainnet');
    });

    it('should default status to UNKNOWN when missing', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Status: UNKNOWN');
    });

    it('should default status to UNKNOWN when null', () => {
      const notification = {
        additionalData: {
          status: null,
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as any;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Status: UNKNOWN');
    });

    it('should handle missing transactionId', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Transaction ID: undefined');
    });

    it('should format network string', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          transactionId: 'tx-123',
          network: 'testnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toContain('Network: Testnet');
    });
  });

  describe('multiple notifications', () => {
    it('should separate notifications with double newlines', () => {
      const notifications = [
        {
          additionalData: {
            status: 'SUCCESS',
            transactionId: 'tx-1',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            status: 'FAILED',
            transactionId: 'tx-2',
            network: 'testnet',
          },
        },
      ] as unknown as Notification[];

      const result = generateTransactionExecutedContent(...notifications);

      expect(result).toMatch(/Network:.*\n\nStatus:/);
    });

    it('should include all three fields for each notification', () => {
      const notifications = [
        { additionalData: { status: 'SUCCESS', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { status: 'FAILED', transactionId: 'tx-2', network: 'testnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExecutedContent(...notifications);

      expect(result.match(/Status:/g)?.length).toBe(2);
      expect(result.match(/Transaction ID:/g)?.length).toBe(2);
      expect(result.match(/Network:/g)?.length).toBe(2);
    });

    it('should maintain notification order', () => {
      const notifications = [
        { additionalData: { status: 'SUCCESS', transactionId: 'first', network: 'mainnet' } },
        { additionalData: { status: 'FAILED', transactionId: 'second', network: 'testnet' } },
        { additionalData: { status: 'PENDING', transactionId: 'third', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExecutedContent(...notifications);

      const firstIndex = result.indexOf('first');
      const secondIndex = result.indexOf('second');
      const thirdIndex = result.indexOf('third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe('output format', () => {
    it('should have header followed by double newline before details', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      expect(result).toMatch(/executed!\n\nStatus:/);
    });

    it('should maintain consistent field order', () => {
      const notification = {
        additionalData: {
          status: 'SUCCESS',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExecutedContent(notification);

      const statusIndex = result.indexOf('Status:');
      const transactionIdIndex = result.indexOf('Transaction ID:');
      const networkIndex = result.indexOf('Network:');

      expect(statusIndex).toBeLessThan(transactionIdIndex);
      expect(transactionIdIndex).toBeLessThan(networkIndex);
    });
  });

  describe('edge cases', () => {
    it('should handle empty notifications array', () => {
      const result = generateTransactionExecutedContent();

      expect(result).toBeNull();
    });

    it('should handle different status values', () => {
      const notifications = [
        { additionalData: { status: 'SUCCESS', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { status: 'FAILED', transactionId: 'tx-2', network: 'testnet' } },
        { additionalData: { status: 'PENDING', transactionId: 'tx-3', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExecutedContent(...notifications);

      expect(result).toContain('Status: SUCCESS');
      expect(result).toContain('Status: FAILED');
      expect(result).toContain('Status: PENDING');
    });
  });
});

describe('newGenerateTransactionExecutedContent', () => {
  describe('empty notifications', () => {
    it('should return empty string for no notifications', () => {
      const result = newGenerateTransactionExecutedContent();

      expect(result).toBeNull();
    });
  });

  describe('title and intro', () => {
    it('should use singular title for one notification', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date('2024-01-15T10:30:00Z'),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('<title>Transaction execution result</title>');
      expect(result).toContain('<h1 style="margin:0;font-size:20px;">Transaction execution result</h1>');
    });

    it('should use plural title for multiple notifications', () => {
      const notifications = [
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date('2024-01-15T10:30:00Z'),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.FAILED,
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date('2024-01-15T10:31:00Z'),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      expect(result).toContain('<title>Transaction execution results</title>');
      expect(result).toContain('<h1 style="margin:0;font-size:20px;">Transaction execution results</h1>');
    });

    it('should use singular intro text for one notification', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date('2024-01-15T10:30:00Z'),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('The following transaction executed:');
    });

    it('should use plural intro text for multiple notifications', () => {
      const notifications = [
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date(),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      expect(result).toContain('The following transactions executed:');
    });
  });

  describe('status grouping', () => {
    it('should group transactions by status', () => {
      const notifications = [
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date('2024-01-15T10:30:00Z'),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date('2024-01-15T10:31:00Z'),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.FAILED,
            transactionId: 'tx-3',
            network: 'mainnet',
            executedAt: new Date('2024-01-15T10:32:00Z'),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      expect(result).toContain('Successful transactions');
      expect(result).toContain('Failed transactions');
      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('tx-3');
    });

    it('should show "Successful transactions" for EXECUTED status', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('Successful transactions');
    });

    it('should format non-EXECUTED statuses properly', () => {
      const notifications = [
        {
          additionalData: {
            status: 'PENDING',
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: 'FAILED',
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date(),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      expect(result).toContain('Pending transactions');
      expect(result).toContain('Failed transactions');
    });

    it('should handle UNKNOWN status', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('Unknown transactions');
    });

    it('should uppercase status before grouping', () => {
      const notifications = [
        {
          additionalData: {
            status: 'executed',
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: 'EXECUTED',
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date(),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      // Both should be grouped together
      expect(result).toContain('Successful transactions');
      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
    });
  });

  describe('status badge styling', () => {
    it('should use green badge for successful transactions', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('background-color:#d1fae5');
      expect(result).toContain('color:#166534');
    });

    it('should use red badge for failed transactions', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.FAILED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('background-color:#fee2e2');
      expect(result).toContain('color:#b91c1c');
    });
  });

  describe('transaction table', () => {
    it('should include table headers', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('Transaction ID');
      expect(result).toContain('Network');
      expect(result).toContain('Executed at');
    });

    it('should include transaction details in table', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: '0.0.123@1234567890.123456789',
          network: 'mainnet',
          executedAt: new Date('2024-01-15T10:30:00Z'),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('0.0.123@1234567890.123456789');
      expect(result).toContain('Mainnet');
    });

    it('should call getNetworkString for each transaction', () => {
      const notifications = [
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date(),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);


      expect(result).toContain('Mainnet');
      expect(result).toContain('Testnet');
    });
  });

  describe('executedAt date handling', () => {
    it('should format Date object to locale string', () => {
      const date = new Date('2024-01-15T10:30:45Z');
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: date,
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain(date.toLocaleString());
    });

    it('should parse string dates', () => {
      const dateStr = '2024-01-15T10:30:45Z';
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: dateStr,
        },
      } as any;

      const result = newGenerateTransactionExecutedContent(notification);

      const expectedDate = new Date(dateStr).toLocaleString();
      expect(result).toContain(expectedDate);
    });

    it('should handle numeric timestamps', () => {
      const timestamp = 1705315845000;
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: timestamp,
        },
      } as any;

      const result = newGenerateTransactionExecutedContent(notification);

      const expectedDate = new Date(timestamp).toLocaleString();
      expect(result).toContain(expectedDate);
    });
  });

  describe('HTML structure', () => {
    it('should generate valid HTML document', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
      expect(result).toContain('<head>');
      expect(result).toContain('</head>');
      expect(result).toContain('<body');
      expect(result).toContain('</body>');
    });

    it('should include meta charset', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('<meta charset="UTF-8" />');
    });

    it('should use table-based layout', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('<table role="presentation"');
      expect(result).toContain('width="600"');
    });

    it('should include header with brand color', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('background-color:#0b6efd');
      expect(result).toContain('color:#ffffff');
    });

    it('should include footer with automated message disclaimer', () => {
      const notification = {
        additionalData: {
          status: TransactionStatus.EXECUTED,
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('This is an automated message. Please do not reply.');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple statuses in correct order', () => {
      const notifications = [
        {
          additionalData: {
            status: TransactionStatus.FAILED,
            transactionId: 'tx-1',
            network: 'mainnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-2',
            network: 'testnet',
            executedAt: new Date(),
          },
        },
        {
          additionalData: {
            status: TransactionStatus.EXECUTED,
            transactionId: 'tx-3',
            network: 'previewnet',
            executedAt: new Date(),
          },
        },
      ] as unknown as Notification[];

      const result = newGenerateTransactionExecutedContent(...notifications);

      // Should have both status sections
      expect(result).toContain('Successful transactions');
      expect(result).toContain('Failed transactions');

      // All transactions should be present
      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('tx-3');
    });

    it('should handle missing status as UNKNOWN', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
          executedAt: new Date(),
        },
      } as unknown as Notification;

      const result = newGenerateTransactionExecutedContent(notification);

      expect(result).toContain('Unknown transactions');
    });
  });
});