# notification

**Description**: A table that contains information about notifications.

## Columns

| Column Name   | Type      | Description                                                             |
| ------------- | --------- | ----------------------------------------------------------------------- |
| **id**        | Integer   | The primary key for the table. Unique identifier for each notification. |
| **type**      | String    | Type of the notification                                                |
| **content**   | String    | Text/Content of the notification                                        |
| **entityId**  | Integer   | Id of the entity                                                        |
| **actorId**   | Integer   | Id of the actor                                                         |
| **createdAt** | Timestamp | Timestamp of when the notification was created.                         |

### Example Query

```sql
SELECT * FROM "notification" WHERE "id" = '1';
```

### Example Response

```
id: 1

type: TRANSACTION_READY_FOR_EXECUTION

content: Transaction 0.0.2163514@1724154115.332000000 is ready for execution

entityId: 76

actorId: 1

createdAt: 2024-05-24 00:55:18.452957
```
