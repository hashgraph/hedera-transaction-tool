# transaction_group_item
**Description**: A transaction group is a collection of transactions that need to be executed simultaneously. This allows for a coordinated and synchronized execution of multiple related transactions. The `transaction_group_item` table stores information about the individual transaction in the transaction group and its relative sequence to other transactions in the group.
## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **seq**            | Integer    |  Sequence of transaction execution within the transaction group, if it matter. If the sequence is not important this can be null.                 |               
| **transactionId**       | String     |  The transaction id ( Foreign key to transaction)                                          |
| **groupId**     | Timestamp  |  The group id of the transaction ( Foreign key to transaction_group )                              |


## Example Query and Response

### Example Query
```sql
SELECT * FROM "transaction_group_item";
```
