# user_key
**Description**: A table that contains information about user's keys. 

## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **id**          | Integer    | The primary key for the table. Unique identifier for each key.                 |
| **mnemonicHash**        | String     | The name of the transaction given by the Creator.                                              |
| **index**        | String     | The index at which the private key was created.                                 |
| **publicKey** | Text       | Public key associated with the key.                                              |
| **deletedAt**| String    | Timestamp of when the key was removed    |
| **userId**| String  | The ID of the related user. ( Foreign key to user)             |
