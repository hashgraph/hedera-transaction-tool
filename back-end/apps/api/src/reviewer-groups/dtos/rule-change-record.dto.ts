import { Expose } from 'class-transformer';

import { AttestationSignature, ChangeRequestStatus, ReviewerAction, RulePayload } from '@entities';

export class RuleChangeRecordDto {
  @Expose() id: number;
  @Expose() ruleId: number | null;
  @Expose() groupId: number | null;
  @Expose() action: ReviewerAction;
  @Expose() status: ChangeRequestStatus;
  @Expose() rulePayload: RulePayload;
  @Expose() groupSnapshotVersion: number | null;
  @Expose() attestationSignatures: AttestationSignature[] | null;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
