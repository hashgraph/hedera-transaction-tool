# user_key

**Description**: A table that contains information about user's keys.

## Columns

| Column Name      | Type    | Description                                                    |
| ---------------- | ------- | -------------------------------------------------------------- |
| **id**           | Integer | The primary key for the table. Unique identifier for each key. |
| **mnemonicHash** | String  | The mneumonic (24 word recovery phrase) hash.                  |
| **index**        | String  | The index at which the private key was created.                |
| **publicKey**    | Text    | Public key associated with the key.                            |
| **deletedAt**    | String  | Timestamp of when the key was removed                          |
| **userId**       | String  | The ID of the related user. ( Foreign key to user)             |

### Example Query

```sql
SELECT * FROM "user_key" WHERE "id" = '1' ;

```

### Example Response

```sql
1 | 7a40e67733edaec462d6b4a31f026cc37f96f767d6a581e41f71785516d42929 |     0 | 5a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f |           |      1
```

```
id: 1

mnemonicHash: 7a40e67733edaec462d6b4a31f026cc37f96f767d6a581e41f71785516d42929

index: 0

publicKey: 5a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f

deletedAt:

userId: 1
```
