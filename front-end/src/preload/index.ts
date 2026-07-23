import { contextBridge } from 'electron';

import localUserAPI from './localUser';

export const electronAPI = {
  local: {
    ...localUserAPI,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
