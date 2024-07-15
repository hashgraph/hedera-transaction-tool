# user
**Description**: A table that contains information about each user. 

## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **id**          | Integer    | The primary key for the table. Unique identifier for each user.                 |
| **email**        | String     | The email address for each user. It is **required** and must be **unique**.                                              |
| **password**        | String     | The encrypted password. (required)                               |
| **admin** | boolean       | Whether or not this user is an admin (true/false)                                              |
| **status** | String     | Status of the user. |
| **createdAt**| Timestamp  | Timestamp of when the user was created.             |
| **updatedAt**   | Timestamp  | Timestamp of when the user was updated.                           |
| **deletedAt**   | Timestamp  | Timestamp of when the user was removed.                      |

