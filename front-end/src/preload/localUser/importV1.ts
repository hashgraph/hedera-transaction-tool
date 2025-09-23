import type { V1ImportFilterResult } from '@shared/interfaces';

import { ipcRenderer } from 'electron';

export default {
  importV1: {
    filterForImportV1: (filePaths: string[]): Promise<V1ImportFilterResult> =>
      ipcRenderer.invoke('importV1:filterForImportV1', filePaths),
  },
};
