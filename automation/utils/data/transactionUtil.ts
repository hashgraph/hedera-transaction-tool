import { SignatureMap } from '@hashgraph/sdk';

export function signatureMapToV1Json(signatureMap: SignatureMap): string {
  const result: {
    [nodeAccountId: string]: {
      [publicKey: string]: string;
    };
  } = {};
  for (const nodeAccountId of signatureMap.keys()) {
    result[nodeAccountId.toString()] = {};
    const txMap = signatureMap.get(nodeAccountId);
    if (txMap) {
      for (const transactionId of txMap.keys()) {
        const pkMap = txMap.get(transactionId);
        if (pkMap) {
          for (const publicKey of pkMap.keys()) {
            const signature = pkMap.get(publicKey);
            if (signature) {
              // Convert signature to base64
              result[nodeAccountId.toString()][publicKey.toStringRaw()] =
                Buffer.from(signature).toString('base64');
            }
          }
        }
      }
    }
  }
  return JSON.stringify(result);
}
