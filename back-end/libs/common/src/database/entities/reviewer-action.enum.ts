export enum ReviewerAction {
  ADD = 'add',
  REMOVE = 'remove',
  // UPDATE will be needed when condition evaluation is introduced — changing a
  // condition (e.g. amount threshold) is an in-place update requiring the same
  // group threshold attestation as REMOVE. Only updating the condition will be supported.
}
