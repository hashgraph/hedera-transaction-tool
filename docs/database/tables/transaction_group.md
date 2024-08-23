# transaction_group

**Description**: A transaction group is a collection of transactions that need to be executed simultaneously. This allows for a coordinated and synchronized execution of multiple related transactions. The `transaction_group` table stores information about transaction groups the users create.

## Columns

| Column Name     | Type      | Description                                                      |
| --------------- | --------- | ---------------------------------------------------------------- |
| **id**          | Integer   | The primary key for the table. Unique identifier for each group. |
| **description** | String    | Description of the group transactions and their purpose.         |
| **listId**      | Integer   |                                                                  |
| **threshold**   | Integer   |                                                                  |
| **userKeyId**   | Integer   |                                                                  |
| **signature**   | Bytes     |                                                                  |
| **userId**      | Integer   |                                                                  |
| **approved**    | Boolean   |                                                                  |
| **createdAt**   | Timestamp |                                                                  |
| **updatedAt**   | Timestamp |                                                                  |
| **deletedAt**   | Timestamp |                                                                  |

## Example Query and Response

### Example Query

```sql
SELECT * FROM "transaction_group" WHERE "id" = `1`;
```

### Example Response

```
id: 1

transactionId: 2

listId: 4

threshold: 5

userKeyId: 6

signature: \xb62bc5acf687ec884125f263c0c0f303f1562b3a38e2cd8785f10cf6ab91dae4f27faceb25fba7c05a7add0ddeaa6f40149ac23bad1dbfa6efb980752ff41409

userId: 3

approved: TRUE

createdAt: 2024-05-24 18:13:28.82329

updatedAt: 2024-05-24 18:13:28.82329

deletedAt: 2024-05-24 18:13:28.82329
```
