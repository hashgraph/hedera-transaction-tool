# user

**Description**: A table that contains information about each user.

## Columns

| Column Name   | Type      | Description                                                                 |
| ------------- | --------- | --------------------------------------------------------------------------- |
| **id**        | Integer   | The primary key for the table. Unique identifier for each user.             |
| **email**     | String    | The email address for each user. It is **required** and must be **unique**. |
| **password**  | String    | The encrypted password. (required)                                          |
| **admin**     | boolean   | Whether or not this user is an admin (true/false)                           |
| **status**    | String    | Status of the user.                                                         |
| **createdAt** | Timestamp | Timestamp of when the user was created.                                     |
| **updatedAt** | Timestamp | Timestamp of when the user was updated.                                     |
| **deletedAt** | Timestamp | Timestamp of when the user was removed.                                     |

### Example Query

```sql
SELECT * FROM "user" WHERE "id" = '1';

```

### Example Response

```sql
1 | test@test.com | $2a$10********************** | t     | NONE   | 2024-05-24 00:55:18.452957 | 2024-06-20 16:15:45.583935 |          |
```

```
id: 1

email: test@test.com

password: $2a$10**********************

admin: t

status: NONE

createdAt: 2024-05-24 00:55:18.452957

updatedAt: 2024-06-20 16:15:45.583935

deletedAt:


```
