import { Notification } from '@entities';
import { generateTransactionExpiredContent } from '@app/common/templates/transaction-expired';

describe('generateTransactionExpiredContent', () => {
  describe('header content', () => {
    it('should use singular header for one notification', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('A transaction has expired.');
      expect(result).not.toContain('Multiple transactions');
    });

    it('should use plural header for multiple notifications', () => {
      const notifications = [
        { additionalData: { transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { transactionId: 'tx-2', network: 'testnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('Multiple transactions have expired.');
      expect(result).not.toContain('A transaction has');
    });
  });

  describe('transaction details', () => {
    it('should include transaction ID', () => {
      const notification = {
        additionalData: {
          transactionId: '0.0.123@1234567890.123456789',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Transaction ID: 0.0.123@1234567890.123456789');
    });

    it('should include network information', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'testnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Network: Testnet');
    });

    it('should handle missing transactionId', () => {
      const notification = {
        additionalData: {
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Transaction ID: undefined');
    });

    it('should handle missing network', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Network:');
    });

    it('should handle missing additionalData', () => {
      const notification = {} as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Transaction ID: undefined');
      expect(result).toContain('Network:');
    });

    it('should handle null values in additionalData', () => {
      const notification = {
        additionalData: {
          transactionId: null,
          network: null,
        },
      } as unknown as any;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Transaction ID: null');
      expect(result).toContain('Network:');
    });
  });

  describe('multiple notifications', () => {
    it('should separate notifications with double newlines', () => {
      const notifications = [
        {
          additionalData: {
            transactionId: 'tx-1',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            transactionId: 'tx-2',
            network: 'testnet',
          },
        },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('Mainnet');
      expect(result).toContain('Testnet');

      // Check for double newline separation between transaction details
      expect(result).toMatch(/Network:.*\n\nTransaction ID:/);
    });

    it('should format each notification with both fields', () => {
      const notifications = [
        {
          additionalData: {
            transactionId: 'tx-1',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            transactionId: 'tx-2',
            network: 'testnet',
          },
        },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result.match(/Transaction ID:/g)?.length).toBe(2);
      expect(result.match(/Network:/g)?.length).toBe(2);
    });

    it('should handle three or more notifications', () => {
      const notifications = [
        { additionalData: { transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { transactionId: 'tx-2', network: 'testnet' } },
        { additionalData: { transactionId: 'tx-3', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('tx-3');
      expect(result).toContain('Mainnet');
      expect(result).toContain('Testnet');
      expect(result).toContain('Previewnet');
    });

    it('should maintain notification order', () => {
      const notifications = [
        { additionalData: { transactionId: 'first', network: 'mainnet' } },
        { additionalData: { transactionId: 'second', network: 'testnet' } },
        { additionalData: { transactionId: 'third', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      const firstIndex = result.indexOf('first');
      const secondIndex = result.indexOf('second');
      const thirdIndex = result.indexOf('third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('should call getNetworkString for each notification', () => {
      const notifications = [
        { additionalData: { transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { transactionId: 'tx-2', network: 'testnet' } },
        { additionalData: { transactionId: 'tx-3', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('Network: Mainnet');
      expect(result).toContain('Network: Testnet');
      expect(result).toContain('Network: Previewnet');
    });
  });

  describe('output format', () => {
    it('should have header followed by double newline before details', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toMatch(/expired\.\n\nTransaction ID:/);
    });

    it('should maintain consistent field order', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      const transactionIdIndex = result.indexOf('Transaction ID:');
      const networkIndex = result.indexOf('Network:');

      expect(transactionIdIndex).toBeLessThan(networkIndex);
    });

    it('should use single newline between transaction ID and network', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toMatch(/Transaction ID: tx-123\nNetwork: Mainnet/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty notifications array', () => {
      const result = generateTransactionExpiredContent();

      expect(result).toBeNull();
    });

    it('should handle mix of complete and incomplete data', () => {
      const notifications = [
        {
          additionalData: {
            transactionId: 'tx-complete',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            transactionId: 'tx-no-network',
          },
        },
        {
          additionalData: {
            network: 'testnet',
          },
        },
        {} as Notification,
      ] as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('tx-complete');
      expect(result).toContain('tx-no-network');
      expect(result.match(/Transaction ID:/g)?.length).toBe(4);
      expect(result.match(/Network:/g)?.length).toBe(4);
    });

    it('should handle different network types', () => {
      const notifications = [
        { additionalData: { transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { transactionId: 'tx-2', network: 'testnet' } },
        { additionalData: { transactionId: 'tx-3', network: 'previewnet' } },
        { additionalData: { transactionId: 'tx-4', network: 'custom-network' } },
      ] as unknown as Notification[];

      const result = generateTransactionExpiredContent(...notifications);

      expect(result).toContain('Network: Mainnet');
      expect(result).toContain('Network: Testnet');
      expect(result).toContain('Network: Previewnet');
      expect(result).toContain('custom-network');
    });

    it('should handle special characters in transaction IDs', () => {
      const notification = {
        additionalData: {
          transactionId: '0.0.123@1234567890.123456789-memo',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateTransactionExpiredContent(notification);

      expect(result).toContain('Transaction ID: 0.0.123@1234567890.123456789-memo');
    });
  });
});