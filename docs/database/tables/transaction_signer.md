# transaction_signer
**Description**: A table that contains information about the transaction signers of a given transaction ID. 

## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **id**          | Integer    | The primary key for the table. Unique identifier for each signature for a transaction.                 |
| **transactionId**| String    | ID of the transaction that requires the signature from the user.  (Foreign key to transaction)   |
| **userKeyid**| Integer  | Id of the user public key. ( Foreign key to user_keys)              |
| **userId**        | Integer       | The ID of the user. |
| **createAt**    | Timestamp  | The timestamp when the transaction was signed by the Signer.                                 |



