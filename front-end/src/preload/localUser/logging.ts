import type { LogLevel } from '@shared/utils/logging';

import { ipcRenderer } from 'electron';

export default {
  logging: {
    log: (
      level: LogLevel,
      component: string,
      message: string,
      metadata?: unknown,
    ): Promise<void> => ipcRenderer.invoke('logging:log', level, component, message, metadata),
  },
};
