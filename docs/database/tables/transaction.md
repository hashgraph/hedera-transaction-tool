# transaction
**Description**: This table stores transaction records and associated metadata.

## Columns

| Column Name     | Type       | Description                                                                            |
|-----------------|------------|----------------------------------------------------------------------------------------|
| **id**          | Integer    | The primary key for the table. Unique identifier for each transaction.                 |
| **name**        | String     | The name of the transaction given by the Creator.                                              |
| **type**        | String     | The type of transaction created by the user (AccountCreate/AccountUpdate/AccountDelete/TransferTransaction/FileCreate/FileUpdate/FileAppend/Freeze).                                 |
| **description** | Text       | Detailed description of the transaction.                                               |
| **transactionId**| String    | A unique identifier for the transaction (transactionPayerAccountID@transactionValidStartTime -> `0.0.1280@1716577920.000000000`).     |
| **transactionhash**| String  | The hash of the transaction.              |
| **body**        | Text       | The body content of the transaction, represented in bytes |
| **collate body**| String     | The transaction once it is collated with the required number of signatures. If the required signers have not yet signed, this field remains null.                 |
| **status**      | String     | The current status of the transaction returned in the transaction receipt (e.g. EXECUTED, //ToDo: list the availabe statuses)                  |
| **status code** | Integer    | A numeric code representing the transaction status. (e.g 22 for SUCCESS)                                   |
| **signature**   | String     | The signature hash of the creator.|
| **validStart**  | Timestamp  | The timestamp when the transaction becomes valid in nanoseconds.                                      |
| **network**     | String     | The network through which the transaction was processed (mainnet, testnet, previewnet local node.                               |
| **cutoff_At**    | Timestamp  | The timestamp at which the transaciton can no longer be signed by the signers.                                        |
| **createAt**    | Timestamp  | The timestamp when the transaction was created by the Creator.                                 |
| **executedAt**  | Timestamp  | The timestamp when the transaction was executed.                                       |
| **updatedAt**   | Timestamp  | Timestamp indicating when the transaction was last updated.                            |
| **deletedAt**   | Timestamp  | The timestamp when the transaction was deleted, if applicable.                        |
| **creator ID**  | Integer    | The ID of the user who was the creator of the transaction                            |

## Example Query and Response

### Example Query
```sql
SELECT * FROM "transaction" WHERE "id: = '1';

```

### Example Response
```sql
1 | test transaction | ACCOUNT CREATE | test transaction | 0.0.1280@1716577920.000000000 | 0x93ee278b3692e8d4edd692d6228b13193cd05e96ae611d393df5c75f2bd1c6b6620566b04cbee327644cf913f62fd403 | \x0a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001808188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a4011e86fb4b09edb8d6e6dda6282c95eb12d04ff22e0e51389a6e5e9ca1cec7424a6c9155478e63c70318e48fdea65372f736b373cb9a1906becbd09901613b8060a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001803188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a40f0d61b5e4f62da062cfcb851beb62fb26f844f3ff856f9fb534f4097f7d0b938286c295002856d4aafda373198bb64abdafe667e6ff32c8f027524acb79836080a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001806188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a40bd28b163c69dcf7200d3aad1ec19548cd2bb36f9d079ffa92ae38ad3fb79c181b8bd7fe2ac64b4240d112ded16a7d8c3103a761d3cb2bfab31872336706b34000a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001809188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a400f74cee4fda64b80599cd0337194f4d35b2a1f003f5d9b045ff6715b230dccef17f0b1e36cae9703e532dfc1e4d1e2bf70cd86d13bbd4341be9b7d5d68a8ce010a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001807188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a409553e5604eaf5efd18bad4eca3913e4b0e4a348915630455f048e898fa3cb1cb3192ebd015973e463d89d66035d8c7a54741cb2c217f0b9ffaddea999ff6320a |              | EXECUTED |         22 | \xb62bc5acf687ec884125f263c0c0f303f1562b3a38e2cd8785f10cf6ab91dae4f27faceb25fba7c05a7add0ddeaa6f40149ac23bad1dbfa6efb980752ff41409 | 2024-05-24 19:12:00 | testnet |          | 2024-05-24 18:13:28.82329 | 2024-05-24 19:12:05.014 | 2024-05-24 19:12:06.743835 |           |            2
```

```

id: 1

name: test transaction

type: ACCOUNT CREATE

description: test transaction

transactionId: 0.0.1280@1716577920.000000000

transactionhash: 0x93ee278b3692e8d4edd692d6228b13193cd05e96ae611d393df5c75f2bd1c6b6620566b04cbee327644cf913f62fd403

body: \x0a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001808188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a4011e86fb4b09edb8d6e6dda6282c95eb12d04ff22e0e51389a6e5e9ca1cec7424a6c9155478e63c70318e48fdea65372f736b373cb9a1906becbd09901613b8060a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001803188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a40f0d61b5e4f62da062cfcb851beb62fb26f844f3ff856f9fb534f4097f7d0b938286c295002856d4aafda373198bb64abdafe667e6ff32c8f027524acb79836080a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001806188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a40bd28b163c69dcf7200d3aad1ec19548cd2bb36f9d079ffa92ae38ad3fb79c181b8bd7fe2ac64b4240d112ded16a7d8c3103a761d3cb2bfab31872336706b34000a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001809188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a400f74cee4fda64b80599cd0337194f4d35b2a1f003f5d9b045ff6715b230dccef17f0b1e36cae9703e532dfc1e4d1e2bf70cd86d13bbd4341be9b7d5d68a8ce010a9d022a9a020aaf010a150a080880cdc3b206100012070800100018800a18001206080010001807188084af5f220308b401321074657374207472616e73616374696f6e5a720a4a32480a2212205a7245ff4fbbc301ec0a4b4c9d04117d7527759431d8fab1729a7dbfb715094f0a221220d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b100030ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a00700088010012660a640a20d292412f1c86507224c1db656050c2162c91983540d608f6a31e9b4c9bdee82b1a409553e5604eaf5efd18bad4eca3913e4b0e4a348915630455f048e898fa3cb1cb3192ebd015973e463d89d66035d8c7a54741cb2c217f0b9ffaddea999ff6320a 
collate body: 

status: EXECUTED

status code: 22

signature: \xb62bc5acf687ec884125f263c0c0f303f1562b3a38e2cd8785f10cf6ab91dae4f27faceb25fba7c05a7add0ddeaa6f40149ac23bad1dbfa6efb980752ff41409

validStart: 2024-05-24 19:12:00

network: testnet

cutoffAt: 2024-05-24 18:13:28.82329

createAt: 2024-05-24 19:12:05.014 

executedAt: 2024-05-24 19:12:06.743835

updatedAt:

deletedAt:

creator ID: 2

```
