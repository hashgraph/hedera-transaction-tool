# notification_receiver

**Description**: A table that contains information about in app notifications.

## Columns

| Column Name         | Type      | Description                                                             |
| ------------------- | --------- | ----------------------------------------------------------------------- |
| **id**              | Integer   | The primary key for the table. Unique identifier for each notification. |
| **notificationId**  | Integer   | Id of the notification                                                  |
| **userId**          | Integer   | Id of the user                                                          |
| **isRead**          | Boolean   | Is notification read                                                    |
| **isInAppNotified** | Boolean   | Is user notified in App                                                 |
| **isEmailSent**     | Boolean   | Is notification in Email                                                |
| **updatedAt**       | Timestamp | When is updated                                                         |

### Example Query

```sql
SELECT * FROM "notification_receiver" WHERE "id" = '1';
```

### Example Response

```
id: 1

notificationId: 4

userId: 2

isRead: FALSE

isInAppNotified: TRUE

isEmailSent: TRUE

updatedAt: 2024-08-20 11:42:21.062333
```
