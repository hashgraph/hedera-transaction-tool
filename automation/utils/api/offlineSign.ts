import { PrivateKey, Transaction } from '@hiero-ledger/sdk';
import type { SignatureMapPayload } from './organizationApi.js';

// Structural shape of the SDK's signTransaction return value:
// Map<AccountId, Map<TransactionId, Map<PublicKey, Uint8Array>>>. We only
// rely on Map iteration and toString()/toStringDer() on the keys, so the
// nominal SDK types aren't worth importing.
type Stringable = { toString(): string };
type DerEncodable = { toStringDer(): string };
type SdkSignatureMap = Map<Stringable, Map<Stringable, Map<DerEncodable, Uint8Array>>>;

export function signTransactionForBackend(
  txBytes: Buffer,
  privateKeyEd25519Hex: string,
): SignatureMapPayload {
  const tx = Transaction.fromBytes(txBytes);
  const pk = PrivateKey.fromStringED25519(privateKeyEd25519Hex);
  const signatureMap = pk.signTransaction(tx) as unknown as SdkSignatureMap;
  return signatureMapToBackendFormat(signatureMap);
}

function signatureMapToBackendFormat(signatureMap: SdkSignatureMap): SignatureMapPayload {
  const result: SignatureMapPayload = {};
  for (const nodeAccountId of signatureMap.keys()) {
    const nodeKey = nodeAccountId.toString();
    result[nodeKey] = {};
    const txMap = signatureMap.get(nodeAccountId);
    if (!txMap) continue;
    for (const transactionId of txMap.keys()) {
      const txKey = transactionId.toString();
      result[nodeKey][txKey] = {};
      const pkMap = txMap.get(transactionId);
      if (!pkMap) continue;
      for (const publicKey of pkMap.keys()) {
        const pubKeyDer = publicKey.toStringDer();
        const signature = pkMap.get(publicKey);
        if (!signature) continue;
        result[nodeKey][txKey][pubKeyDer] = '0x' + Buffer.from(signature).toString('hex');
      }
    }
  }
  return result;
}
