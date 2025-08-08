import { CommonNetwork } from '@shared/enums';

/* Mappings */
export const networkMapping: {
  [key in string]: { label: string; className: string };
} = {
  [CommonNetwork.TESTNET]: {
    label: 'TESTNET',
    className: 'text-testnet',
  },
  [CommonNetwork.MAINNET]: {
    label: 'MAINNET',
    className: 'text-mainnet',
  },
  [CommonNetwork.PREVIEWNET]: {
    label: 'PREVIEWNET',
    className: 'text-previewnet',
  },
  [CommonNetwork.LOCAL_NODE]: {
    label: 'LOCAL NODE',
    className: 'text-info',
  },
};
