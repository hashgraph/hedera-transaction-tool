import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';
import { filterForImportV1 } from '@main/services/localUser/importV1';

export default () => {
  /* Transactions */
  createIPCChannel(
    'importV1', [
      renameFunc(filterForImportV1, 'filterForImportV1')
    ]
  );
};
