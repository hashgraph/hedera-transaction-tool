import { Transaction } from '@hashgraph/sdk';
import * as unzipper from 'unzipper';
import * as path from 'path';
import { extractUnzipperFileToBuffer } from '@main/utils/files';
import { V1ImportCandidate, V1ImportFilterResult } from '@shared/interfaces';

export async function filterForImportV1(filePaths: string[]): Promise<V1ImportFilterResult> {
  const result: V1ImportFilterResult = {
    candidates: [],
    ignoredPaths: [],
  };

  for (const filePath of filePaths) {
    const candidate = await filterCandidate(filePath);
    if (candidate !== null) {
      result.candidates.push(candidate);
    } else {
      result.ignoredPaths.push(filePath);
    }
  }

  return Promise.resolve(result);
}

async function filterCandidate(filePath: string): Promise<V1ImportCandidate | null> {
  let result: V1ImportCandidate | null;
  try {
    const zipDirectory = await unzipper.Open.file(filePath);
    const txFile = zipDirectory.files.find(f => path.extname(f.path) === '.tx');
    const jsonFile = zipDirectory.files.find(f => path.extname(f.path) === '.json');
    if (txFile && jsonFile) {
      const txBytes = await extractUnzipperFileToBuffer(txFile);
      const tx = Transaction.fromBytes(txBytes);
      const transactionId = tx.transactionId
      if (transactionId !== null) {
        const txHex = txBytes.toString('hex');
        const jsonBytes = await extractUnzipperFileToBuffer(jsonFile);
        const jsonText = jsonBytes.toString()
        const jsonObj = JSON.parse(jsonText);
        result = {
          filePath: filePath,
          transactionId: transactionId.toString(),
          transactionBytes: txHex,
          nodeSignatures: jsonObj,
        };
      } else {
        /* It's unclear how we can get a transaction without id => we disable code coverage here */
        /* c8 ignore next */
        result = null
        /* c8 ignore next */
      }
    } else {
      result = null;
    }
  } catch {
    result = null;
  }
  return Promise.resolve(result);
}
