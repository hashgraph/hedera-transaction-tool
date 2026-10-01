// TODO: a later batch replaces every FEATURE_APPROVERS_ENABLED check (BaseApproversObserverData.vue,
// TransactionDetails*, TransactionGroupDetails.vue) with FEATURE_REVIEWER_ENABLED and removes this
// flag — kept here for now so this commit doesn't drag in that unrelated, still-untested change.
export const FEATURE_APPROVERS_ENABLED = false;
export const FEATURE_REVIEWER_ENABLED = true;
export const FEATURE_EXTERNAL_BADGE_ENABLED = true;
