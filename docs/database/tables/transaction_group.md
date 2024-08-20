# transaction_group

**Description**: A transaction group is a collection of transactions that need to be executed simultaneously. This allows for a coordinated and synchronized execution of multiple related transactions. The `transaction_group` table stores information about transaction groups the users create.

## Columns

| Column Name     | Type      | Description                                                      |
| --------------- | --------- | ---------------------------------------------------------------- |
| **id**          | Integer   | The primary key for the table. Unique identifier for each group. |
| **description** | String    | Description of the group transactions and their purpose.         |
| **atomic**      | boolean   | A flag that specifies how to execute the transactions.           |
| **createdAt**   | Timestamp | Timestamp indicating when the group was created.                 |

## Example Query and Response

### Example Query

```sql
SELECT * FROM "transaction_group" WHERE "id" = `1`;
```
