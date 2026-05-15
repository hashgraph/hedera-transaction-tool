import { AddressBookQuery, Client, FileId } from '@hiero-ledger/sdk';

export const getNodeAddressBook = async (mirrorNetwork: string) => {
  const client = Client.forNetwork({}).setMirrorNetwork(mirrorNetwork);

  const nodeAddressBook = await new AddressBookQuery()
    .setFileId(FileId.ADDRESS_BOOK)
    .execute(client);

  client?.close();

  return nodeAddressBook._toProtobuf();
};
