import { Expose } from 'class-transformer';

import { AttestationSignature, ChangeRequestStatus, GroupChangeType, GroupSnapshot } from '@entities';

export class GroupChangeRecordDto {
  @Expose() id: number;
  @Expose() groupId: number;
  @Expose() type: GroupChangeType;
  @Expose() status: ChangeRequestStatus;
  @Expose() snapshotVersion: number;
  @Expose() snapshotPayload: GroupSnapshot;
  @Expose() attestationSignatures: AttestationSignature[];
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
