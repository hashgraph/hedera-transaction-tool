export interface ITransactionNode {   //   Single   Group
  transactionId?: number;             //      x
  groupId?: number;                   //              x
  description: string;                //      x       x
  createdAt: string;                  //      x       x
  validStart: string;                 //      x       x
  updatedAt: string;                  //      x       x
  executedAt?: string;                //      x       x
  status?: string;                    //      x
  statusCode?: number;                //      x
  sdkTransactionId?: string;          //      x
  transactionType?: string;           //      x
  isManual?: boolean;                 //      x
  groupItemCount?: number;            //              x
  groupCollectedCount?: number;       //              x
}

export enum TransactionNodeCollection {
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  READY_TO_SIGN = "READY_TO_SIGN",
  READY_FOR_EXECUTION = "READY_FOR_EXECUTION", // Deprecated (subset of IN_PROGRESS collection)
  IN_PROGRESS = "IN_PROGRESS",
  HISTORY = "HISTORY",
}


/*

    ITransactionNode | Single Transaction | Transaction Group    |
    ---------------- + ------------------ + -------------------- +
    transactionId    | tx id              | undefined            |
    groupId          | undefined          | group id             |
    description      | tx description     | group description    |
    createdAt        | tx created at      | group created at     |
    validStart       | tx valid start     | min item valid start |
    updatedAt        | tx updated at      | max item updated at  |
    executedAt       | tx executed at     | max item executed at |
    status           | tx status          | undefined            |
    statusCode       | tx status code     | undefined            |
    sdkTransactionId | hiero tx id        | undefined            |
    transactionType  | tx type            | undefined            |
    isManual         | tx is manual       | undefined            |
    groupItemCount   | 0                  | group item count     |

 */
