import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import { addClaim, getClaims, removeClaims, updateClaim } from '@main/services/localUser/claim';

const createChannelName = (...props) => ['claim', ...props].join(':');

export default () => {
  /* Claim */

  // Add claim
  ipcMain.handle(
    createChannelName('add'),
    (_e, userId: string, claimKey: string, claimValue: string) =>
      addClaim(userId, claimKey, claimValue),
  );

  // Get claims
  ipcMain.handle(createChannelName('get'), (_e, findArgs: Prisma.ClaimFindManyArgs) =>
    getClaims(findArgs),
  );

  // Update claim
  ipcMain.handle(
    createChannelName('update'),
    (_e, userId: string, claimKey: string, claimValue: string) =>
      updateClaim(userId, claimKey, claimValue),
  );

  // Remove claim
  ipcMain.handle(createChannelName('remove'), (_e, userId: string, claimKeys: string[]) =>
    removeClaims(userId, claimKeys),
  );
};
