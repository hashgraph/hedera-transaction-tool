// The legacy transaction-approver controls (BaseApproversObserverData.vue) still call an
// addApprovers() endpoint removed from the back-end (#3413); keep them behind this flag,
// independent of FEATURE_REVIEWER_ENABLED, until that submission flow is migrated or removed.
export const FEATURE_APPROVERS_ENABLED = false;
export const FEATURE_REVIEWER_ENABLED = true;
export const FEATURE_EXTERNAL_BADGE_ENABLED = true;
