import { PrivateKey, Transaction } from '@hiero-ledger/sdk';
import * as fsp from 'fs/promises';
import JSZip from 'jszip';
import * as path from 'node:path';
import { signatureMapToV1Json } from '../data/transactionUtil.js';

export async function writeMergedV1SignatureZip(
  outputDir: string,
  zipName: string,
  tx: Transaction,
  txBytes: Uint8Array,
  privateKeys: string[],
  transactionFileName = 'transaction.tx',
): Promise<string> {
  const sigJsonPath = path.join(outputDir, `${zipName}.json`);
  const sigZipPath = path.join(outputDir, `${zipName}.zip`);
  const mergedSignatures: Record<string, Record<string, string>> = {};

  for (const privateKey of privateKeys) {
    const pk = PrivateKey.fromStringED25519(privateKey);
    const signatureSet = JSON.parse(
      signatureMapToV1Json(pk.signTransaction(tx)),
    ) as Record<string, Record<string, string>>;

    for (const [nodeAccountId, signaturesByPublicKey] of Object.entries(signatureSet)) {
      mergedSignatures[nodeAccountId] = {
        ...(mergedSignatures[nodeAccountId] ?? {}),
        ...signaturesByPublicKey,
      };
    }
  }

  const zip = new JSZip();
  zip.file(path.basename(sigJsonPath), Buffer.from(JSON.stringify(mergedSignatures)));
  zip.file(path.basename(transactionFileName), txBytes);
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
  await fsp.writeFile(sigZipPath, zipContent);

  return sigZipPath;
}
