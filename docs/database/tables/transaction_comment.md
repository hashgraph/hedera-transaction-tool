# transaction_comment

**Description**: The table that stores comments left by the users for a given transaction.

## Columns

| Column Name       | Type      | Description                                                                       |
| ----------------- | --------- | --------------------------------------------------------------------------------- |
| **id**            | Integer   | The primary key for the table. Unique identifier for each comment                 |
| **message**       | String    | The text of the comment left by the user                                          |
| **createdAt**     | Timestamp | Timestamp indicating when the comment was created                                 |
| **transactionId** | String    | ID of the transaction associated with the approver. (Foreign key to transactions) |
| **userId**        | Integer   | ID of the user (Foreign key to the users table)                                   |

## Example Query and Response

### Example Query

```sql
SELECT * FROM "transaction_comment" WHERE "id" = `1`;
```
