export enum ChangeRequestStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
}

// One entry per member response. vote and signature together are what the member
// produces — the signature is computed over { vote, payload } so the backend
// cannot flip a reject to an approve without invalidating the signature.
export interface AttestationSignature {
  userKeyId: number;
  vote: 'approve' | 'reject';
  signature: string;
}
