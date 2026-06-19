// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { type Key } from '@hiero-ledger/sdk';

import { useFileTransactionAssert } from '@renderer/composables/useFileTransactionAssert';

const mocks = vi.hoisted(() => ({
  decodeProto: vi.fn(),
  encodeSpecialFileContent: vi.fn(),
  isFileId: vi.fn(),
  isHederaSpecialFileId: vi.fn(),
  isLoggedInOrganization: vi.fn(),
  safeAwait: vi.fn(),
}));

vi.mock('@renderer/services/transactionService', () => ({
  encodeSpecialFileContent: mocks.encodeSpecialFileContent,
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    selectedOrganization: null,
  }),
}));

vi.mock('@renderer/utils', () => ({
  isFileId: mocks.isFileId,
  isLoggedInOrganization: mocks.isLoggedInOrganization,
  safeAwait: mocks.safeAwait,
}));

vi.mock('@shared/hederaSpecialFiles', () => ({
  isHederaSpecialFileId: mocks.isHederaSpecialFileId,
}));

describe('useFileTransactionAssert', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('window', {
      electronAPI: {
        local: {
          files: {
            decodeProto: mocks.decodeProto,
          },
        },
      },
    });
    mocks.isFileId.mockReturnValue(true);
    mocks.isLoggedInOrganization.mockReturnValue(true);
    mocks.safeAwait.mockImplementation(async (promise: Promise<unknown>) => {
      try {
        return { data: await promise, error: null };
      } catch (error) {
        return { data: undefined, error };
      }
    });
  });

  test('passes through already-valid protobuf Uint8Array content unchanged', async () => {
    const contents = Uint8Array.from([1, 2, 3]);
    const data = {
      fileId: '0.0.111',
      contents,
    };

    mocks.isHederaSpecialFileId.mockReturnValue(true);
    mocks.decodeProto.mockResolvedValue('{"currentFeeSchedule":{}}');
    mocks.encodeSpecialFileContent.mockResolvedValue(Uint8Array.from([9, 9, 9]));

    await useFileTransactionAssert(data, ref({} as Key))();

    expect(mocks.decodeProto).toHaveBeenCalledWith('0.0.111', contents);
    expect(mocks.encodeSpecialFileContent).toHaveBeenCalledTimes(1);
    expect(data.contents).toBe(contents);
  });

  test('encodes decoded text content before submission', async () => {
    const contents = '{"throttleBuckets":[] }';
    const data = {
      fileId: '0.0.123',
      contents,
    };

    mocks.isHederaSpecialFileId.mockReturnValue(true);
    mocks.encodeSpecialFileContent.mockResolvedValue(Uint8Array.from([4, 5, 6]));

    await useFileTransactionAssert(data, ref({} as Key))();

    expect(mocks.decodeProto).not.toHaveBeenCalled();
    expect(mocks.encodeSpecialFileContent).toHaveBeenCalledWith(
      new TextEncoder().encode(JSON.stringify(contents)),
      '0.0.123',
    );
    expect(data.contents).toEqual(Uint8Array.from([4, 5, 6]));
  });

  test('surfaces an error when decode and encode both fail', async () => {
    const contents = Uint8Array.from([7, 8, 9]);
    const data = {
      fileId: '0.0.121',
      contents,
    };

    mocks.isHederaSpecialFileId.mockReturnValue(true);
    mocks.decodeProto.mockRejectedValue(new Error('decode failed'));
    mocks.encodeSpecialFileContent.mockRejectedValue(new Error('encode failed'));

    await expect(useFileTransactionAssert(data, ref({} as Key))()).rejects.toThrow(
      'Failed to encode special file content',
    );

    expect(data.contents).toBe(contents);
  });

  test('does nothing for non-special file IDs', async () => {
    const contents = '{"anything":true}';
    const data = {
      fileId: '0.0.200',
      contents,
    };

    mocks.isHederaSpecialFileId.mockReturnValue(false);

    await useFileTransactionAssert(data, ref({} as Key))();

    expect(mocks.decodeProto).not.toHaveBeenCalled();
    expect(mocks.encodeSpecialFileContent).not.toHaveBeenCalled();
    expect(data.contents).toBe(contents);
  });

  test('throws when file ID is invalid', async () => {
    mocks.isFileId.mockReturnValue(false);
    const data = { fileId: 'not-a-file-id', contents: null };

    await expect(useFileTransactionAssert(data, ref({} as Key))()).rejects.toThrow(
      'Invalid File ID',
    );
  });

  test('throws when signature key is missing and user is not in an organization', async () => {
    mocks.isLoggedInOrganization.mockReturnValue(false);
    const data = { fileId: '0.0.111', contents: null };

    await expect(useFileTransactionAssert(data, ref(null))()).rejects.toThrow(
      'Signature key is required',
    );
  });

  test('passes through Uint8Array unchanged when decode returns undefined', async () => {
    const contents = Uint8Array.from([1, 2, 3]);
    const data = { fileId: '0.0.121', contents };

    mocks.isHederaSpecialFileId.mockReturnValue(true);
    mocks.decodeProto.mockResolvedValue(undefined);

    await useFileTransactionAssert(data, ref({} as Key))();

    expect(mocks.encodeSpecialFileContent).not.toHaveBeenCalled();
    expect(data.contents).toBe(contents);
  });

  test('encodes Uint8Array content when round-trip re-encode fails', async () => {
    const contents = Uint8Array.from([7, 8, 9]);
    const encoded = Uint8Array.from([4, 5, 6]);
    const data = { fileId: '0.0.112', contents };

    mocks.isHederaSpecialFileId.mockReturnValue(true);
    mocks.decodeProto.mockResolvedValue('garbage decoded from json bytes');
    mocks.encodeSpecialFileContent
      .mockRejectedValueOnce(new Error('re-encode failed'))
      .mockResolvedValueOnce(encoded);

    await useFileTransactionAssert(data, ref({} as Key))();

    expect(mocks.encodeSpecialFileContent).toHaveBeenCalledTimes(2);
    expect(mocks.encodeSpecialFileContent).toHaveBeenLastCalledWith(contents, '0.0.112');
    expect(data.contents).toEqual(encoded);
  });
});
