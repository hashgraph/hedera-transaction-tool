
export interface V1ImportFilterResult {
  candidates: V1ImportCandidate[];
  ignoredPaths: string[];
}
export interface V1ImportCandidate {
  filePath: string;
  transactionId: string;
  transactionBytes: string;
  nodeSignatures: V1ImportSignatureSet;
}
export type V1ImportSignatureSet = Record<string, Record<string, string>>
