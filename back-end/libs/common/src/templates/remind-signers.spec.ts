import { generateRemindSignersContent } from '.';
import { Notification } from '@entities';

describe('generateRemindSignersContent', () => {
  describe('header content', () => {
    it('should use singular header for one notification', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-01T00:00:00Z',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('A transaction has not collected');
      expect(result).toContain('locate the transaction.');
      expect(result).not.toContain('Multiple transactions');
    });

    it('should use plural header for multiple notifications', () => {
      const notifications = [
        { additionalData: { validStart: '2024-01-01', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { validStart: '2024-01-02', transactionId: 'tx-2', network: 'testnet' } },
      ] as unknown as Notification[];

      const result = generateRemindSignersContent(...notifications);

      expect(result).toContain('Multiple transactions have not collected');
      expect(result).toContain('locate the transactions.');
      expect(result).not.toContain('A transaction has not');
    });
  });

  describe('validStart date handling', () => {
    it('should format valid ISO date string to UTC string', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-15T10:30:45Z',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: Mon, 15 Jan 2024 10:30:45 GMT');
    });

    it('should display "unknown" when validStart is null', () => {
      const notification = {
        additionalData: {
          validStart: null,
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: unknown');
    });

    it('should display "unknown" when validStart is undefined', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: unknown');
    });

    it('should display raw value when validStart is an invalid date string', () => {
      const notification = {
        additionalData: {
          validStart: 'invalid-date',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: invalid-date');
    });

    it('should handle numeric timestamp', () => {
      const timestamp = 1705315845000; // 2024-01-15T10:50:45Z
      const notification = {
        additionalData: {
          validStart: timestamp,
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: Mon, 15 Jan 2024 10:50:45 GMT');
    });
  });

  describe('transaction details', () => {
    it('should include transaction ID', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-01',
          transactionId: '0.0.123@1234567890.123456789',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Transaction ID: 0.0.123@1234567890.123456789');
    });

    it('should include network information', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-01',
          transactionId: 'tx-123',
          network: 'testnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Network: Testnet');
    });

    it('should handle missing additionalData gracefully', () => {
      const notification = {} as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: unknown');
      expect(result).toContain('Transaction ID: undefined');
      expect(result).toContain('Network:');
    });
  });

  describe('multiple notifications', () => {
    it('should separate multiple notifications with double newlines', () => {
      const notifications = [
        {
          additionalData: {
            validStart: '2024-01-01T00:00:00Z',
            transactionId: 'tx-1',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            validStart: '2024-01-02T00:00:00Z',
            transactionId: 'tx-2',
            network: 'testnet',
          },
        },
      ] as unknown as Notification[];

      const result = generateRemindSignersContent(...notifications);

      // Should have details for both transactions
      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('Mainnet');
      expect(result).toContain('Testnet');

      // Should be separated by double newlines
      const detailsSections = result.split('\n\n');
      expect(detailsSections.length).toBeGreaterThan(2); // Header + at least 2 transactions
    });

    it('should format each notification with proper structure', () => {
      const notifications = [
        {
          additionalData: {
            validStart: '2024-01-01T00:00:00Z',
            transactionId: 'tx-1',
            network: 'mainnet',
          },
        },
        {
          additionalData: {
            validStart: '2024-01-02T00:00:00Z',
            transactionId: 'tx-2',
            network: 'testnet',
          },
        },
      ] as unknown as Notification[];

      const result = generateRemindSignersContent(...notifications);

      // Each notification should have all three fields
      expect(result.match(/Valid start:/g)?.length).toBe(2);
      expect(result.match(/Transaction ID:/g)?.length).toBe(2);
      expect(result.match(/Network:/g)?.length).toBe(2);
    });

    it('should handle three or more notifications', () => {
      const notifications = [
        { additionalData: { validStart: '2024-01-01', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { validStart: '2024-01-02', transactionId: 'tx-2', network: 'testnet' } },
        { additionalData: { validStart: '2024-01-03', transactionId: 'tx-3', network: 'previewnet' } },
      ] as unknown as Notification[];

      const result = generateRemindSignersContent(...notifications);

      expect(result).toContain('tx-1');
      expect(result).toContain('tx-2');
      expect(result).toContain('tx-3');
      expect(result).toContain('Multiple transactions');
    });
  });

  describe('output format', () => {
    it('should have header followed by double newline before details', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-01',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toMatch(/Please visit.*\n\nValid start:/);
    });

    it('should maintain consistent field order', () => {
      const notification = {
        additionalData: {
          validStart: '2024-01-01',
          transactionId: 'tx-123',
          network: 'mainnet',
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      const validStartIndex = result.indexOf('Valid start:');
      const transactionIdIndex = result.indexOf('Transaction ID:');
      const networkIndex = result.indexOf('Network:');

      expect(validStartIndex).toBeLessThan(transactionIdIndex);
      expect(transactionIdIndex).toBeLessThan(networkIndex);
    });
  });

  describe('edge cases', () => {
    it('should handle empty notifications array', () => {
      const result = generateRemindSignersContent();

      expect(result).toBeNull();
    });

    it('should handle notifications with partial data', () => {
      const notification = {
        additionalData: {
          transactionId: 'tx-123',
          // missing validStart and network
        },
      } as unknown as Notification;

      const result = generateRemindSignersContent(notification);

      expect(result).toContain('Valid start: unknown');
      expect(result).toContain('Transaction ID: tx-123');
      expect(result).toContain('Network:');
    });

    it('should call getNetworkString for each notification', () => {
      const notifications = [
        { additionalData: { validStart: '2024-01-01', transactionId: 'tx-1', network: 'mainnet' } },
        { additionalData: { validStart: '2024-01-02', transactionId: 'tx-2', network: 'testnet' } },
      ] as unknown as Notification[];

      const result = generateRemindSignersContent(...notifications);

      expect(result).toContain('Network: Mainnet');
      expect(result).toContain('Network: Testnet');
    });
  });
});