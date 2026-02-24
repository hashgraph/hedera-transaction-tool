/* Public Queue Patterns */
export const TRANSACTION_STATUS_UPDATE = 'notifications.queue.transaction.status-update';
export const TRANSACTION_UPDATE = 'notifications.queue.transaction.update';
export const TRANSACTION_REMIND_SIGNERS = 'notifications.queue.transaction.remind-signers';
export const TRANSACTION_REMIND_SIGNERS_MANUAL = 'notifications.queue.transaction.remind-signers.manual';
export const USER_INVITE = 'notifications.queue.email.invite';
export const USER_REGISTERED = 'notifications.queue.user.registered';
export const USER_PASSWORD_RESET = 'notifications.queue.email.password-reset';
export const DISMISSED_NOTIFICATIONS = 'notifications.queue.notification.dismiss';

/* Private FanOut Patterns */
export const FAN_OUT_NEW_NOTIFICATIONS = 'notifications.fan-out.new';
export const FAN_OUT_DELETE_NOTIFICATIONS = 'notifications.fan-out.delete';
export const FAN_OUT_NOTIFY_CLIENTS = 'notifications.fan-out.notify';

/* Private Queue Patterns */
export const EMAIL_NOTIFICATIONS = 'notifications.queue.email';