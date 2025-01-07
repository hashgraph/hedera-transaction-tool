export const decodedString = `{
  "currentRate": {
    "hbars": 30000,
    "cents": 316955,
    "expirationTime": "2024-02-22T11:00:00.000Z",
    "exchangeRateInCents": 10.565166666666666
  },
  "nextRate": {
    "hbars": 30000,
    "cents": 322683,
    "expirationTime": "2024-02-22T12:00:00.000Z",
    "exchangeRateInCents": 10.7561
  }
}`;

export const buffer = [
  10, 16, 8, 176, 234, 1, 16, 155, 172, 19, 26, 6, 8, 176, 210, 220, 174, 6, 18, 16, 8, 176, 234, 1,
  16, 251, 216, 19, 26, 6, 8, 192, 238, 220, 174, 6,
];

export const protoInput = `{
  "currentRate": {
    "hbarEquiv": 30000,
    "centEquiv": 316955,
    "expirationTime": {
      "seconds": 1708599600
    }
  },
  "nextRate": {
    "hbarEquiv": 30000,
    "centEquiv": 322683,
    "expirationTime": {
      "seconds": 1708603200
    }
  }
}`;
