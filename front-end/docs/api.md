# Posting transactions to the backend

### Login

Login request:

```
POST https://example.com/auth/login
content-type: application/json

{
  "email": "test@example.com",
  "password": "aaaaaaaaaa"
}
```

The response should include an access token:


```
{
  "user": {
    "id": 2,
    "email": "test@example.com",
    "admin": false,
    "status": "NONE",
    "createdAt": "2024-10-24T09:23:57.552Z",
    "updatedAt": "2024-10-24T09:43:10.893Z",
    "deletedAt": null
  },
  "accessToken": "AAAAAAAAAAJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoidGltQGxhdW5jaGJhZGdlLmNvbSIsImlhdCI6MTcyOTc2MzA1MCwiZXhwIjoxNzYxMjk5MDUwfQ.n6XY0NX1y6iQvoBTLCi8fUXPEfmmzwVJ5AAAAAAAAAA"
}
```

Make sure to retain this access token for furture requests.

### Create Transaction

Using the SDK, create desired transaction and encode it into a hex string.

Do not freeze the transaction prior to encoding.

To encode Transaction Bytes into a hex string, this function can be used:

```
function uint8ToHex(uint8: Uint8Array) {
  return Array.from(uint8)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};
```

#### File Update

The following snippet will create a File Update Transaction and encode into hex (using the function found in the "Create Transaction" section):

```
const transactionBytes = new FileUpdateTransaction()
  .setTransactionId(TransactionId.withValidStart(AccountId.fromString("YourAccountId"), Timestamp.fromDate(new Date())))
  .setTransactionValidDuration(180)
  .setMaxTransactionFee(new Hbar(2))
  .setFileId("0.0.123")
  .setFileMemo("Example")
  .setKeys(new KeyList([PrivateKey.fromStringED25519("YourKey")]))
  // Optional: .setExpirationTime(Timestamp.fromDate(new Date("YourDate")))
  .setContents("YourContents")
  .toBytes();

console.log(uint8ToHex(transactionBytes));
```

### File Append

The following snippet will create a File Append Transaction and encode into hex (using the function found in the "Create Transaction" section):

```
const transactionBytes = new FileAppendTransaction()
  .setTransactionId(TransactionId.withValidStart(AccountId.fromString("YourAccountId"), Timestamp.fromDate(new Date())))
  .setTransactionValidDuration(180)
  .setMaxTransactionFee(new Hbar(2))
  .setFileId("0.0.111")
  .setContents("YourContents")
  .toBytes();

console.log(uint8ToHex(transactionBytes));
```

### Account Update

The following snippet will create an Account Update Transaction and encode into hex (using the function found in the "Create Transaction" section):

```
const transactionBytes = new AccountUpdateTransaction()
  .setTransactionId(TransactionId.withValidStart(AccountId.fromString("YourAccountId"), Timestamp.fromDate(new Date())))
  .setTransactionValidDuration(180)
  .setMaxTransactionFee(new Hbar(2))
  .setAccountId("0.0.2")
  .setReceiverSignatureRequired(false)
  .setDeclineStakingReward(false)
  .setMaxAutomaticTokenAssociations(3)
  .setAccountMemo("Example")
  .setKey(PrivateKey.fromStringED25519("YourKey"))
  // Only Use one of the following (setStakeAccountId, setStakedNodeId, clearStakedAccountId, clearStakedNodeId)
  .setStakedNodeId(0)
  .toBytes();

console.log(uint8ToHex(transactionBytes));
```

### Transfer

The following snippet will create an Transfer Transaction and encode into hex (using the function found in the "Create Transaction" section):

```
const transactionBytes = new TransferTransaction()
  .setTransactionId(TransactionId.withValidStart(AccountId.fromString("YourAccountId"), Timestamp.fromDate(new Date())))
  .setTransactionValidDuration(180)
  .setMaxTransactionFee(new Hbar(2))
  .addHbarTransfer("0.0.2", new Hbar(2))
  .addHbarTransfer("YourAccountId", new Hbar(-2))
  .toBytes();

console.log(uint8ToHex(transactionBytes));
```

### Submitting a Transaction

Hex encoded unsigned transaction bytes must be prepared for the request. Show file update and file append and grouped together for system file update 111. other file updates do not require append.

Make sure to include the signature bytes and how to build that string.

Transaction Request (replace "accessTokenHere" with your access token):

```
POST https://example.com/transactions
Authorization: Bearer accessTokenHere
content-type: application/json

{
  "name":"name",
  "description":"description","transactionBytes":"0a641a0022600a180a0c08cfb6e8b80610c0f5e4950312060800100018021800188084af5f220308b40132009a01370a0608001000187b1a240a221220051bea2d2e654f7cd8fa8e392f1f5183bfd1395e55184cc19e6af3b88000692c22074578616d706c65",
  "network":"testnet","signature":"d8f145bd06537c7b94c0cbd55586c3cab3bca2d32f14838d8feb72def5c890669f57acda3500914c4ba2c5df9e575abff1908ff28284a7a98769b7290e0f4e0a","creatorKeyId":1
}
```

### Submitting a Transaction Group

It may be desired to group some transactions together such as File Update and File Append.

Transaction Group Request (replace "accessTokenHere" with your access token):
```
POST https://example.com/transaction-groups
Authorization: Bearer accessTokenHere
content-type: application/json

{
  "description":"description",
  "atomic": false,
  "groupItems": [
    {
      "seq": 0,
      "transaction": {
        "name":"name",
        "description":"description","transactionBytes":"0a641a0022600a180a0c08cfb6e8b80610c0f5e4950312060800100018021800188084af5f220308b40132009a01370a0608001000187b1a240a221220051bea2d2e654f7cd8fa8e392f1f5183bfd1395e55184cc19e6af3b88000692c22074578616d706c65",
        "network":"testnet","signature":"d8f145bd06537c7b94c0cbd55586c3cab3bca2d32f14838d8feb72def5c890669f57acda3500914c4ba2c5df9e575abff1908ff28284a7a98769b7290e0f4e0a","creatorKeyId":1
    },
    {
      "seq": 1,
      "transaction": {
        "name":"name",
        "description":"description","transactionBytes":"0a641a0022600a180a0c08cfb6e8b80610c0f5e4950312060800100018021800188084af5f220308b40132009a01370a0608001000187b1a240a221220051bea2d2e654f7cd8fa8e392f1f5183bfd1395e55184cc19e6af3b88000692c22074578616d706c65",
        "network":"testnet","signature":"d8f145bd06537c7b94c0cbd55586c3cab3bca2d32f14838d8feb72def5c890669f57acda3500914c4ba2c5df9e575abff1908ff28284a7a98769b7290e0f4e0a","creatorKeyId":1
    },
    ...
  ]

}
```

### Adding Approvers
Single Threshold Approvers Request (replace "accessTokenHere" with your access token):
```
POST https://example.com/transactions/1/approvers
Authorization: Bearer accessTokenHere
content-type: application/json

{
    approversArray: [
      {
         userId: 1
      }
    ]
}
```

Multiple Threshold Approvers Request (replace "accessTokenHere" with your access token):
```
POST https://example.com/transactions/1/approvers
Authorization: Bearer accessTokenHere
content-type: application/json

{
    approversArray: [
      {
        threshold: 2,
        approvers: [
          {
            threshold: 1,
            approvers: [
              {
                userId: 1,
              },
              {
                userId: 2,
              },
            ],
          },
          {
            userId: 3,
            approvers: [],
          },
        ],
      },
    ],
}
```

### Adding Observers
Observers Request (replace "accessTokenHere" with your access token):

```
POST https://example.com/transactions/1/observers
Authorization: Bearer accessTokenHere
content-type: application/json

{
  "userIds": [1, 2]
}
```

### Logout

In order to invalidate the JWT token, a logout request must be made.

```
POST https://example.com/auth/logout
Authorization: Bearer accessTokenHere
content-type: application/json
```

Expected response code:

```
HTTP/2 200 OK
```
