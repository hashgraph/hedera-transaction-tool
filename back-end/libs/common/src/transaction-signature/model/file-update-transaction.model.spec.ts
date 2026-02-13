import { FileUpdateTransaction, Key } from '@hashgraph/sdk';
import { FileUpdateTransactionModel } from './file-update-transaction.model';
import { isHederaSpecialFileId } from '@app/common';

jest.mock('@app/common', () => ({
  isHederaSpecialFileId: jest.fn(),
}));

describe('FileUpdateTransactionModel', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should have TRANSACTION_TYPE defined', () => {
    expect(FileUpdateTransactionModel.TRANSACTION_TYPE).toBe('FileUpdateTransaction');
  });

  it('should return empty array if fileId is a Hedera special file', () => {
    const tx = {
      fileId: { toString: () => 'special-file' },
      keys: [{}, {}],
    } as unknown as FileUpdateTransaction;

    const mockIsHederaSpecialFileId = isHederaSpecialFileId as jest.MockedFunction<
      typeof isHederaSpecialFileId
    >;

    mockIsHederaSpecialFileId.mockReturnValue(true);

    const model = new FileUpdateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
    expect(isHederaSpecialFileId).toHaveBeenCalledWith('special-file');
  });

  it('should return transaction.keys if fileId is not special', () => {
    const key1 = {} as Key;
    const key2 = {} as Key;

    const tx = {
      fileId: { toString: () => 'normal-file' },
      keys: [key1, key2],
    } as unknown as FileUpdateTransaction;

    const mockIsHederaSpecialFileId = isHederaSpecialFileId as jest.MockedFunction<
      typeof isHederaSpecialFileId
    >;

    mockIsHederaSpecialFileId.mockReturnValue(false);

    const model = new FileUpdateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([key1, key2]);
    expect(isHederaSpecialFileId).toHaveBeenCalledWith('normal-file');
  });

  it('should return empty array if transaction.keys is undefined and fileId is not special', () => {
    const tx = {
      fileId: { toString: () => 'normal-file' },
      keys: undefined,
    } as unknown as FileUpdateTransaction;

    const mockIsHederaSpecialFileId = isHederaSpecialFileId as jest.MockedFunction<
      typeof isHederaSpecialFileId
    >;

    mockIsHederaSpecialFileId.mockReturnValue(false);

    const model = new FileUpdateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });
});