import { BadRequestException } from '@nestjs/common';

import { AccountId, PublicKey, SignatureMap, TransactionId } from '@hiero-ledger/sdk';

import { decode, ErrorCodes, isAccountId, isTransactionId } from '@app/common';

import { Transform, Expose } from 'class-transformer';

export function IsSignatureMap() {
  const isObject = (child: unknown) => child && typeof child === 'object';

  const assertNodeAccountIdValid = (nodeAccountId: string, transactionIds: unknown) => {
    if (!isAccountId(nodeAccountId) || !isObject(transactionIds)) {
      throw new BadRequestException(ErrorCodes.ISNMP);
    }
  };

  const assertTransactionIdValid = (transactionId: string, publicKeys: unknown) => {
    if (!isTransactionId(transactionId) || !isObject(publicKeys)) {
      throw new BadRequestException(ErrorCodes.ISNMP);
    }
  };

  return function (target: object, propertyKey: string) {
    // ONLY apply Transform - remove Type() completely
    Transform(({ value /*, obj */}) => {
      // If already transformed, return as-is
      if (value instanceof SignatureMap) {
        return value;
      }

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
    }, { toClassOnly: true })(target, propertyKey);

    // IMPORTANT: Tell class-transformer to process this property
    Expose()(target, propertyKey);
  };
}
