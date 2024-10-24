import { AddressBookQuery, Client, FileId } from '@hashgraph/sdk';

export const getNodeAddressBook = async (mirrorNetwork: string) => {
  const client = Client.forNetwork({}).setMirrorNetwork(mirrorNetwork);

  const nodeAddressBook = await new AddressBookQuery()
    .setFileId(FileId.ADDRESS_BOOK)
    .execute(client);

  return nodeAddressBook._toProtobuf();
};
