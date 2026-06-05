import { BlockNodeApi } from '@hiero-ledger/sdk';

export const labelForBlockNodeApi = (apiOrNumber: BlockNodeApi | number) => {
  let result: string;
  const apiCode = typeof apiOrNumber === 'number' ? apiOrNumber : Number(apiOrNumber);
  switch (apiCode) {
    case Number(BlockNodeApi.Other):
      result = 'Other';
      break;
    case Number(BlockNodeApi.Status):
      result = 'Status';
      break;
    case Number(BlockNodeApi.Publish):
      result = 'Publish';
      break;
    case Number(BlockNodeApi.SubscribeStream):
      result = 'Sub. Stream';
      break;
    case Number(BlockNodeApi.StateProof):
      result = 'State Proof';
      break;
    default:
      result = apiCode.toString();
      break;
  }
  return result;
};
