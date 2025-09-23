
export interface V1ImportFilterResult {
  candidatePaths: Record<string, { transactionBytes: string; nodeSignatures: V1ImportSignatureSet; }>;
  ignoredPaths: string[];
}

type V1ImportSignatureSet = Record<string, Record<string, string>>
