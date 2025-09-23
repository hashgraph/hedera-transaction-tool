import type { V1ImportFilterResult } from '@shared/interfaces';

export async function filterForImportV1(filePaths: string[]): Promise<V1ImportFilterResult> {
  const result: V1ImportFilterResult = {
    candidatePaths: {},
    ignoredPaths: filePaths
  }

  console.log("filePaths=" + JSON.stringify(filePaths, null, 2));

  return Promise.resolve(result);
}
