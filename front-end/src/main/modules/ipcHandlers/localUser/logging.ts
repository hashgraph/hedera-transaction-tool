import { logRendererMessage } from '@main/modules/logger';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  createIPCChannel('logging', [renameFunc(logRendererMessage, 'log')]);
};
