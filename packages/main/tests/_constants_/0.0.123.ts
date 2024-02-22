export const decodedString = `{
  "throttleBuckets": [
    {
      "throttleGroups": [
        {
          "operations": [
            "ScheduleCreate",
            "CryptoCreate",
            "CryptoTransfer",
            "CryptoUpdate",
            "CryptoDelete",
            "CryptoGetInfo",
            "CryptoGetAccountRecords",
            "ConsensusCreateTopic",
            "ConsensusSubmitMessage",
            "ConsensusUpdateTopic",
            "ConsensusDeleteTopic",
            "ConsensusGetTopicInfo",
            "TokenGetNftInfo",
            "TokenGetInfo",
            "ScheduleDelete",
            "ScheduleGetInfo",
            "FileGetContents",
            "FileGetInfo",
            "ContractUpdate",
            "ContractDelete",
            "ContractGetInfo",
            "ContractGetBytecode",
            "ContractGetRecords",
            "ContractCallLocal",
            "TransactionGetRecord",
            "GetVersionInfo",
            "TokenGetAccountNftInfos",
            "TokenGetNftInfos",
            "CryptoApproveAllowance",
            "CryptoDeleteAllowance",
            "UtilPrng"
          ],
          "milliOpsPerSec": "10500000"
        },
        {
          "operations": [
            "FileCreate",
            "FileUpdate",
            "FileAppend",
            "FileDelete"
          ],
          "milliOpsPerSec": "13000"
        },
        {
          "operations": [
            "ScheduleSign"
          ],
          "milliOpsPerSec": "100000"
        },
        {
          "operations": [
            "TokenMint"
          ],
          "milliOpsPerSec": "125000"
        },
        {
          "operations": [
            "ContractCall",
            "ContractCreate",
            "EthereumTransaction"
          ],
          "milliOpsPerSec": "350000"
        },
        {
          "operations": [
            "TokenCreate",
            "TokenDelete",
            "TokenBurn",
            "TokenUpdate",
            "TokenFeeScheduleUpdate",
            "TokenAssociateToAccount",
            "TokenAccountWipe",
            "TokenDissociateFromAccount",
            "TokenFreezeAccount",
            "TokenUnfreezeAccount",
            "TokenGrantKycToAccount",
            "TokenRevokeKycFromAccount",
            "TokenPause",
            "TokenUnpause"
          ],
          "milliOpsPerSec": "3000000"
        }
      ],
      "name": "ThroughputLimits",
      "burstPeriodMs": "15000"
    },
    {
      "throttleGroups": [
        {
          "operations": [
            "FileGetContents",
            "FileGetInfo",
            "ContractGetInfo",
            "ContractGetBytecode",
            "ContractCallLocal"
          ],
          "milliOpsPerSec": "700000"
        }
      ],
      "name": "OffHeapQueryLimits",
      "burstPeriodMs": "1000"
    },
    {
      "throttleGroups": [
        {
          "operations": [
            "FileCreate",
            "FileUpdate",
            "FileAppend",
            "FileDelete"
          ],
          "milliOpsPerSec": "10000"
        }
      ],
      "name": "PriorityReservations",
      "burstPeriodMs": "3000"
    },
    {
      "throttleGroups": [
        {
          "operations": [
            "CryptoCreate"
          ],
          "milliOpsPerSec": "2000"
        },
        {
          "operations": [
            "ConsensusCreateTopic"
          ],
          "milliOpsPerSec": "5000"
        },
        {
          "operations": [
            "TokenCreate",
            "TokenAssociateToAccount",
            "ScheduleCreate"
          ],
          "milliOpsPerSec": "100000"
        }
      ],
      "name": "CreationLimits",
      "burstPeriodMs": "15000"
    },
    {
      "throttleGroups": [
        {
          "operations": [
            "CryptoGetAccountBalance",
            "TransactionGetReceipt"
          ],
          "milliOpsPerSec": "1000000000"
        }
      ],
      "name": "FreeQueryLimits",
      "burstPeriodMs": "1000"
    }
  ]
}`;

export const buffer = [
  10, 124, 10, 16, 84, 104, 114, 111, 117, 103, 104, 112, 117, 116, 76, 105, 109, 105, 116, 115, 16,
  152, 117, 26, 38, 10, 31, 70, 27, 1, 2, 3, 15, 14, 50, 54, 51, 52, 53, 75, 58, 71, 73, 23, 24, 8,
  30, 17, 18, 26, 16, 25, 35, 74, 76, 81, 82, 86, 16, 160, 239, 128, 5, 26, 9, 10, 4, 9, 11, 10, 12,
  16, 200, 101, 26, 7, 10, 1, 72, 16, 160, 141, 6, 26, 7, 10, 1, 65, 16, 200, 208, 7, 26, 9, 10, 3,
  6, 7, 84, 16, 176, 174, 21, 26, 21, 10, 14, 56, 63, 66, 64, 77, 68, 67, 69, 59, 60, 61, 62, 79,
  80, 16, 192, 141, 183, 1, 10, 36, 10, 18, 79, 102, 102, 72, 101, 97, 112, 81, 117, 101, 114, 121,
  76, 105, 109, 105, 116, 115, 16, 232, 7, 26, 11, 10, 5, 23, 24, 17, 18, 16, 16, 224, 220, 42, 10,
  36, 10, 20, 80, 114, 105, 111, 114, 105, 116, 121, 82, 101, 115, 101, 114, 118, 97, 116, 105, 111,
  110, 115, 16, 184, 23, 26, 9, 10, 4, 9, 11, 10, 12, 16, 144, 78, 10, 46, 10, 14, 67, 114, 101, 97,
  116, 105, 111, 110, 76, 105, 109, 105, 116, 115, 16, 152, 117, 26, 6, 10, 1, 27, 16, 208, 15, 26,
  6, 10, 1, 50, 16, 136, 39, 26, 9, 10, 3, 56, 68, 70, 16, 160, 141, 6, 10, 32, 10, 15, 70, 114,
  101, 101, 81, 117, 101, 114, 121, 76, 105, 109, 105, 116, 115, 16, 232, 7, 26, 10, 10, 2, 13, 36,
  16, 128, 148, 235, 220, 3,
];
