import { ipcRenderer } from 'electron';

import { Prisma, TransactionGroup } from '@prisma/client';

export default {
  transactionGroups: {
    addGroup: (group: Prisma.TransactionGroupUncheckedCreateInput): Promise<TransactionGroup> =>
      ipcRenderer.invoke('transactionGroups:addGroup', group),
  },
};
