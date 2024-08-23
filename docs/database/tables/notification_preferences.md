# notification_preferences

**Description**: A table that contains information about notification preferences.

## Columns

| Column Name | Type    | Description                                                             |
| ----------- | ------- | ----------------------------------------------------------------------- |
| **id**      | Integer | The primary key for the table. Unique identifier for each notification. |
| **userId**  | Integer | Id of the user                                                          |
| **type**    | String  | Type of the notification                                                |
| **email**   | Boolean | Is notification in Email                                                |
| **inApp**   | Boolean | Is notification in App                                                  |

### Example Query

```sql
SELECT * FROM "notification_preferences" WHERE "id" = '1';
```

### Example Response

```
id: 1

userId: 1

type: TRANSACTION_CREATED

email: TRUE

inApp: TRUE
```
