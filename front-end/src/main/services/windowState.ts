import type { Rectangle } from 'electron';

import { BrowserWindow } from 'electron';

import { STATIC_USER, WINDOW_STATE } from '@main/shared/constants';

import { getPrismaClient } from '@main/db/prisma';

/* Sets the window state*/
export const setWindowBounds = async (window: BrowserWindow): Promise<void> => {
  try {
    const prisma = getPrismaClient();

    const claim_value = JSON.stringify(window.getBounds());

    const alreadyAdded = await prisma.claim.findFirst({
      where: {
        claim_key: WINDOW_STATE,
        user: {
          email: STATIC_USER,
        },
      },
    });
    console.log('alreadyAdded', alreadyAdded);

    if (alreadyAdded) {
      await prisma.claim.update({
        where: { id: alreadyAdded?.id },
        data: { claim_value: JSON.stringify(window.getBounds()) },
      });
      return;
    }

    await prisma.claim.create({
      data: {
        claim_key: WINDOW_STATE,
        claim_value,
        user: {
          connect: {
            email: STATIC_USER,
          },
        },
      },
    });
  } catch (error) {
    console.log(error);
  }
};

/* Get window bounds */
export const getWindowBounds = async (): Promise<Rectangle | null> => {
  try {
    const prisma = getPrismaClient();
    const bounds = await prisma.claim.findFirst({
      where: {
        claim_key: WINDOW_STATE,
        user: {
          email: STATIC_USER,
        },
      },
    });
    return bounds ? JSON.parse(bounds.claim_value) : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};
