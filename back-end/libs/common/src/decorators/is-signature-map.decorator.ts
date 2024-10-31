import { BadRequestException } from '@nestjs/common';

import { AccountId, PublicKey, SignatureMap, TransactionId } from '@hashgraph/sdk';

import { decode, ErrorCodes, isAccountId, isTransactionId } from '@app/common';
import { Transform } from 'class-transformer';

export function IsSignatureMap() {
  const isObject = child => child && typeof child === 'object';

  const assertNodeAccountIdValid = (nodeAccountId: string, transactionIds) => {
    if (!isAccountId(nodeAccountId) || !isObject(transactionIds)) {
      throw new BadRequestException(ErrorCodes.ISNMP);
    }
  };

  const assertTransactionIdValid = (transactionId: string, publicKeys) => {
    if (!isTransactionId(transactionId) || !isObject(publicKeys)) {
      throw new BadRequestException(ErrorCodes.ISNMP);
    }
  };

  return Transform(({ value }) => {
    const signatureMap = new SignatureMap();

    if (!isObject(value)) {
      throw new BadRequestException(ErrorCodes.ISNMP);
    }

    for (const nodeAccountId in value) {
      const transactionIds = value[nodeAccountId];

      assertNodeAccountIdValid(nodeAccountId, transactionIds);

      for (const transactionId in transactionIds) {
        const publicKeys = transactionIds[transactionId];
        assertTransactionIdValid(transactionId, publicKeys);

        for (const publicKey in publicKeys) {
          const signature = publicKeys[publicKey];
          const decodedSignature = new Uint8Array(decode(signature));

          if (decodedSignature.length === 0) {
            throw new BadRequestException(ErrorCodes.ISNMP);
          }

          signatureMap.addSignature(
            AccountId.fromString(nodeAccountId),
            TransactionId.fromString(transactionId),
            PublicKey.fromString(publicKey),
            decodedSignature,
          );
        }
      }
    }

    return signatureMap;
  });
}
