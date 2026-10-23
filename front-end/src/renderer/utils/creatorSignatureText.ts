import type { CreatorSignatureStatus } from '.';

export interface CreatorSignatureText {
  /** Short pill label */
  label: string;
  /** One-line explanation, including who to contact */
  message: string;
  /** Body of the confirm dialog shown before signing */
  confirm: string;
  /** Same as `message`, for a transaction group */
  groupMessage: string;
  /** Same as `confirm`, for a transaction group */
  groupConfirm: string;
}

export const CREATOR_SIGNATURE_TEXT: Record<
  Exclude<CreatorSignatureStatus, 'verified'>,
  CreatorSignatureText
> = {
  'data-missing': {
    label: 'Missing signature',
    message: 'Signature data is missing. Contact your organization administrator.',
    confirm:
      "This transaction's creator signature data is missing, so it may have been altered. Contact your organization administrator before signing.",
    groupMessage:
      'Signature data is missing for some transactions. Contact your organization administrator.',
    groupConfirm:
      'Creator signature data is missing for one or more transactions in this group, so they may have been altered. Contact your organization administrator before signing.',
  },
  'creator-unavailable': {
    label: 'Creator unavailable',
    message:
      "The creator is no longer active, so this can't be verified. Contact your organization administrator.",
    confirm:
      "The creator of this transaction is no longer active, so its origin can't be confirmed. Contact your organization administrator before signing.",
    groupMessage:
      "Some creators are no longer active, so those transactions can't be verified. Contact your organization administrator.",
    groupConfirm:
      "The creator of one or more transactions in this group is no longer active, so their origin can't be confirmed. Contact your organization administrator before signing.",
  },
  unverifiable: {
    label: 'Unverifiable',
    message: "Doesn't match the creator's signature. Contact your organization administrator.",
    confirm:
      "This transaction doesn't match its creator's signature. Contact your organization administrator before signing.",
    groupMessage:
      "Some transactions don't match their creator's signature. Contact your organization administrator.",
    groupConfirm:
      "One or more transactions in this group don't match their creator's signature. Contact your organization administrator before signing.",
  },
};
