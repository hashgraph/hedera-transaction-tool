import { mockDeep } from 'vitest-mock-extended';
import prisma from '@main/db/__mocks__/prisma';

import { STATIC_USER, WINDOW_STATE } from '@main/shared/constants';

import { Claim } from '@prisma/client';
import { BrowserWindow } from 'electron';
import { setWindowBounds, getWindowBounds } from '@main/services/windowState';

vi.mock('@main/db/prisma');

describe('Window state Service', () => {
  const mockWindow = mockDeep<BrowserWindow>();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('setWindowBounds', () => {
    it('should update the window bounds if the claim already exists', async () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      mockWindow.getBounds.mockReturnValue(bounds);

      prisma.claim.findFirst.mockResolvedValueOnce({
        id: '1',
        claim_value: JSON.stringify(bounds),
      } as Claim);

      await setWindowBounds(mockWindow);

      expect(prisma.claim.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { claim_value: JSON.stringify(bounds) },
      });
    });

    it('should create a new claim if it does not exist', async () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      mockWindow.getBounds.mockReturnValue(bounds);

      prisma.claim.findFirst.mockResolvedValueOnce(null);

      await setWindowBounds(mockWindow);

      expect(prisma.claim.create).toHaveBeenCalledWith({
        data: {
          claim_key: WINDOW_STATE,
          claim_value: JSON.stringify(bounds),
          user: {
            connect: {
              email: STATIC_USER,
            },
          },
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      mockWindow.getBounds.mockReturnValue(bounds);

      prisma.claim.findFirst.mockRejectedValueOnce(new Error('Database error'));

      await expect(setWindowBounds(mockWindow)).resolves.not.toThrow();
    });
  });

  describe('getWindowBounds', () => {
    it('should retrieve the window bounds if the claim exists', async () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      prisma.claim.findFirst.mockResolvedValueOnce({
        claim_value: JSON.stringify(bounds),
      } as Claim);

      const result = await getWindowBounds();

      expect(result).toEqual(bounds);
    });

    it('should return null if the claim does not exist', async () => {
      prisma.claim.findFirst.mockResolvedValueOnce(null);

      const result = await getWindowBounds();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      prisma.claim.findFirst.mockRejectedValueOnce(new Error('Database error'));

      const result = await getWindowBounds();

      expect(result).toBeNull();
    });
  });
});
