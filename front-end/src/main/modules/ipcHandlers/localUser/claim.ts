import { addClaim, getClaims, removeClaims, updateClaim } from '@main/services/localUser/claim';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Claim */
  createIPCChannel('claim', [
    renameFunc(addClaim, 'add'),
    renameFunc(getClaims, 'get'),
    renameFunc(updateClaim, 'update'),
    renameFunc(removeClaims, 'remove'),
  ]);
};
