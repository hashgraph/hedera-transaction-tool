import {
  connectPostgresDatabase,
  disconnectPostgresDatabase,
  queryPostgresDatabase,
} from './databaseUtil.js';
import { getUserIdByEmail } from './userQueries.js';

const NOTIFICATION_TYPES = [
  'TRANSACTION_CREATED',
  'TRANSACTION_WAITING_FOR_SIGNATURES',
  'TRANSACTION_READY_FOR_EXECUTION',
  'TRANSACTION_EXECUTED',
  'TRANSACTION_EXPIRED',
  'TRANSACTION_INDICATOR_APPROVE',
  'TRANSACTION_INDICATOR_SIGN',
  'TRANSACTION_INDICATOR_EXECUTABLE',
  'TRANSACTION_INDICATOR_EXECUTED',
  'TRANSACTION_INDICATOR_EXPIRED',
] as const;

/**
 * Ensures every required notification type exists in `notification_preferences` for each user.
 *
 * Missing rows are inserted with `email: false` and `inApp: false`. Existing rows are not
 * modified — callers that need to flip flags should follow up with
 * {@link disableNotificationPreferences}.
 *
 * @param userIds - Organization user IDs whose preference rows should be ensured.
 */
export async function ensureNotificationTypesForUsers(userIds: number[]) {
  const client = await connectPostgresDatabase();

  try {
    for (const userId of userIds) {
      for (const type of NOTIFICATION_TYPES) {
        const query = `
          INSERT INTO public.notification_preferences ("userId", type, email, "inApp")
          SELECT $1, $2::varchar, false, false
          WHERE NOT EXISTS (
            SELECT 1 FROM public.notification_preferences
            WHERE "userId" = $1 AND type = $2::varchar
          );
        `;
        const values = [userId, type];
        await client.query(query, values);
      }
    }
  } catch (err) {
    console.error('Error ensuring notification types for users:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

/**
 * Disables email notifications for the given users and toggles the in-app flag.
 *
 * Email is always set to `false`. The in-app flag follows the `inApp` argument, allowing
 * tests that depend on in-app delivery to keep it on while silencing email.
 *
 * @param userIds - Organization user IDs to update.
 * @param inApp - When `true`, leaves in-app notifications enabled; when `false`, disables both.
 */
export async function disableNotificationPreferences(userIds: number[], inApp: boolean) {
  const client = await connectPostgresDatabase();

  try {
    const query = `
        UPDATE public.notification_preferences
        SET email = false,
            "inApp" = ${inApp ? 'true' : 'false'}
        WHERE "userId" = ANY($1::int[]);
    `;
    const values = [userIds];
    const result = await client.query(query, values);
    console.log(`Notification preferences updated for user IDs. Rows affected: ${result.rowCount}`);
  } catch (err) {
    console.error('Error disabling notification preferences:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

/**
 * Convenience wrapper that resolves emails to user IDs, ensures preference rows exist,
 * and then disables email notifications (and optionally in-app) for those users.
 *
 * @param emails - Organization user emails to process.
 * @param inApp - When `true`, leaves in-app notifications enabled. Defaults to `false`.
 */
export async function disableNotificationsForUsers(emails: string[], inApp = false) {
  try {
    const userIds = await Promise.all(emails.map(email => getUserIdByEmail(email)));
    const userIdValues = userIds.filter((userId): userId is number => userId !== null);

    if (userIdValues.length === 0) {
      console.log('No matching users found for notification preference updates.');
      return;
    }

    await ensureNotificationTypesForUsers(userIdValues);
    await disableNotificationPreferences(userIdValues, inApp);
  } catch (err) {
    console.error('Error disabling notifications for selected users:', err);
  }
}

/**
 * Returns the latest in-app SIGN notification status for the given user/transaction pair.
 *
 * Looks up the most recently updated `notification_receiver` row whose related
 * `notification` is of type `TRANSACTION_INDICATOR_SIGN` for the user matching `email`
 * and the transaction matching `transactionId`.
 *
 * @param email - The organization user email.
 * @param transactionId - The SDK transaction ID.
 * @returns `{ isRead, isInAppNotified }` for the latest matching row, or `null` if none found.
 */
export async function getInAppNotificationStatusByEmailAndTransactionId(
  email: string,
  transactionId: string,
): Promise<{ isRead: boolean; isInAppNotified: boolean } | null> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      console.error(`User with email ${email} not found.`);
      return null;
    }

    const query = `
      SELECT nr."isRead", nr."isInAppNotified"
      FROM public.notification_receiver nr
      JOIN public.notification n ON nr."notificationId" = n.id
      JOIN public.transaction t ON n."entityId" = t.id
      WHERE nr."userId" = $1
        AND t."transactionId" = $2
        AND n.type = 'TRANSACTION_INDICATOR_SIGN'
      ORDER BY nr."updatedAt" DESC
      LIMIT 1;
    `;

    const result = await queryPostgresDatabase(query, [userId, transactionId]);
    if (result.length > 0) {
      const { isRead, isInAppNotified } = result[0];
      return { isRead, isInAppNotified };
    }

    return null;
  } catch (error) {
    console.error('Error fetching in-app notification status by email and transaction ID:', error);
    return null;
  }
}

/**
 * Returns the SDK transaction ID of the user's most recent unread in-app indicator notification.
 *
 * Used by tests to locate the specific transaction row in the UI that should currently be
 * highlighted by the notification indicator.
 *
 * @param email - The organization user email.
 * @returns The SDK transaction ID if an unread indicator exists, otherwise `null`.
 */
export async function getNotifiedTransactionIdByEmail(email: string): Promise<string | null> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      console.error(`User with email ${email} not found.`);
      return null;
    }

    const query = `
      SELECT t."transactionId"
      FROM public.notification_receiver nr
      JOIN public.notification n ON nr."notificationId" = n.id
      JOIN public.transaction t ON n."entityId" = t.id
      WHERE nr."userId" = $1
        AND n.type LIKE 'TRANSACTION_INDICATOR_%'
        AND nr."isRead" = false
      ORDER BY nr."updatedAt" DESC
      LIMIT 1;
    `;

    const result = await queryPostgresDatabase<{ transactionId: string }>(query, [userId]);
    if (result.length > 0) {
      return result[0].transactionId;
    }

    return null;
  } catch (error) {
    console.error('Error fetching notified transaction ID:', error);
    return null;
  }
}