import type { Ref } from 'vue';
import type { Key } from '@hiero-ledger/sdk';

import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';
import { isFileId, isLoggedInOrganization, safeAwait } from '@renderer/utils';
import { encodeSpecialFileContent } from '@renderer/services/transactionService';
import useUserStore from '@renderer/stores/storeUser';

export function useFileTransactionAssert(
  data: { fileId: string; contents: Uint8Array | string | null },
  signatureKey: Ref<Key | null>,
) {
  const user = useUserStore();

  return async () => {
    if (!isFileId(data.fileId)) {
      throw Error('Invalid File ID');
    }

    if (!signatureKey.value && !isLoggedInOrganization(user.selectedOrganization)) {
      throw Error('Signature key is required');
    }

    if (isHederaSpecialFileId(data.fileId) && data.contents != null && data.contents.length > 0) {
      let bytes: Uint8Array;

      if (data.contents instanceof Uint8Array) {
        // Check if content is already valid protobuf via decode + re-encode round-trip
        const { data: decoded, error: decodeError } = await safeAwait(
          window.electronAPI.local.files.decodeProto(data.fileId, data.contents),
        );

        if (!decodeError && decoded) {
          const { error: reEncodeError } = await safeAwait(
            encodeSpecialFileContent(new TextEncoder().encode(decoded), data.fileId),
          );
          if (!reEncodeError) {
            // Round-trip succeeded — already valid protobuf, pass through unchanged
            return;
          }
        }

        bytes = data.contents;
      } else {
        bytes = new TextEncoder().encode(data.contents);
      }

      // Content is not already protobuf — attempt to encode it
      const { data: encoded, error: encodeError } = await safeAwait(
        encodeSpecialFileContent(bytes, data.fileId),
      );

      if (encodeError || !encoded) {
        throw new Error('Failed to encode special file content');
      }

      data.contents = encoded;
    }
  };
}
