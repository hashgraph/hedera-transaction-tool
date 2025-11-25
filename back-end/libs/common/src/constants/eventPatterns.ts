/* Websocket patterns */
export const NOTIFY_CLIENT = 'notifications.fanout.notify_client';
export const GET_PORT = 'notifications.fanout.get_port';

/* Email patterns */
export const NOTIFY_EMAIL = 'notifications.queue.notify_email';

/* Notification patterns */
export const NOTIFY_GENERAL = 'notifications.queue.notify_general';
export const NOTIFY_GENERAL_FANOUT = 'notifications.fanout.notify_general';
export const NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES =
  'notifications.queue.notify_transaction_waiting_for_signatures';
export const SYNC_INDICATORS = 'notifications.fanout.sync_indicators';

/* Chain patterns */
export const UPDATE_TRANSACTION_STATUS = 'chain.update_transaction_status';
export const EXECUTE_TRANSACTION = 'chain.execute_transaction';
