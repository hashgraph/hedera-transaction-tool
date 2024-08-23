# transaction_observer

**Description**: A table that contains information about the transaction observers of a given transaction ID.

## Columns

| Column Name       | Type      | Description                                                                            |
| ----------------- | --------- | -------------------------------------------------------------------------------------- |
| **id**            | Integer   | The primary key for the table. Unique identifier for each signature for a transaction. |
| **role**          | String    | Role of the user                                                                       |
| **userId**        | Integer   | Id of the user.                                                                        |
| **transactionId** | Integer   | The ID of the transaction.                                                             |
| **createAt**      | Timestamp | The timestamp when the transaction was created.                                        |

### Example Query

```sql
SELECT * FROM "transaction_observer" WHERE "id" = 1;
```

### Example Response

```
id: 1

role:

userId: 3

transactionId: 4

createAt: 2024-05-24 19:12:06.743835
```
