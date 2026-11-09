import {
  addSmartContract,
  getSmartContractById,
  getSmartContracts,
  removeSmartContracts,
  updateSmartContract,
} from '@main/services/localUser/smartContracts';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Smart Contracts */
  createIPCChannel('smartContracts', [
    renameFunc(addSmartContract, 'add'),
    renameFunc(getSmartContracts, 'getAll'),
    renameFunc(getSmartContractById, 'getOne'),
    renameFunc(updateSmartContract, 'update'),
    renameFunc(removeSmartContracts, 'remove'),
  ]);
};
