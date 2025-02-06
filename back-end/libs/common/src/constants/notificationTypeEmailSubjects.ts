export enum NotificationTypeEmailSubjects {
  TRANSACTION_CREATED = 'Transaction has been created',
  TRANSACTION_WAITING_FOR_SIGNATURES = 'Action Required | Review and Sign Transaction',
  TRANSACTION_READY_FOR_EXECUTION = 'Transaction ready for execution',
  TRANSACTION_EXECUTED = 'Transaction has been executed',
  TRANSACTION_CANCELLED = 'Transaction has been cancelled',
  TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER = 'Approaching Transaction valid start',
  TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL = 'Action Required | Approaching Transaction valid start',
}
