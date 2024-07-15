# transaction_approver
**Description**: Stores information about transactions that require approvers.

## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **id**          | Integer    | The primary key for the table. Unique identifier for each approver/list.                 |                                        |
| **transactionId**| String    | ID of the transaction associated with the approver. (Foreign key to transactions)     |
| **list_id**| String  | Reference to the parent approver list id. Can be null if this is the root approver list, or the transaction only requires a single approver. |
| **threshold**        | Integer       | The body content of the transaction, represented in bytes |
| **userKeyId**| String     |  Reference to the approver’s key used when signing, can be null if this is a list (Foreign key to user_keys) |
| **signature**   | String     | Bytes of the signature. This is null if a list.|
| **userKeyId** | Integer |
| **approved**  | boolean  | A boolean representation indicates whether the approver has approved the transaction. If it is a single key, we should set this field to true when that key signs the transaction. If it is a multisig approver, we should check if we have the required signatures after each signature. If we do, we should set this field to true.                                      |
| **createdAt**     | Timestamp     | Timestamp indicating when the approver was created.                              |
| **updatedAt**     | Timestamp     | Timestamp indicating when the approver was updated.                              |
| **deletedAt**     | Timestamp     | Timestamp indicating when the approver was updated.                              |

## Example Query and Response

### Example Query
```sql
SELECT * FROM "transaction_approver" WHERE "id" = `1`;
```

### Example Response
