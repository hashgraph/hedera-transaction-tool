import * as SDK from '@hashgraph/sdk';
import { getNodeAddressBook } from '@main/services/localUser/sdk';

vi.mock('@hashgraph/sdk', async importOriginal => {
  return {
    ...(await importOriginal<typeof import('@hashgraph/sdk')>()),
  };
});

describe('SDK Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getNodeAddressBook', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should get node address book successfully', async () => {
      const mockMirrorNetwork = 'test-mirror-network';
      const mockClient = {
        setMirrorNetwork: vi.fn().mockReturnThis(),
        close: vi.fn(),
      };
      const mockAddressBookQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
          _toProtobuf: vi.fn().mockReturnValue('mock-protobuf'),
        }),
      };

      vi.spyOn(SDK.Client, 'forNetwork').mockReturnValue(mockClient as any);
      vi.spyOn(SDK, 'AddressBookQuery').mockImplementation(() => mockAddressBookQuery as any);

      const result = await getNodeAddressBook(mockMirrorNetwork);

      expect(mockClient.setMirrorNetwork).toHaveBeenCalledWith(mockMirrorNetwork);
      expect(mockAddressBookQuery.setFileId).toHaveBeenCalledWith(SDK.FileId.ADDRESS_BOOK);
      expect(mockAddressBookQuery.execute).toHaveBeenCalledWith(mockClient);
      expect(result).toBe('mock-protobuf');
    });
  });
});
