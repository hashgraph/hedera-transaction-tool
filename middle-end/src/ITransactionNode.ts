export interface ITransactionNode {   //   Single   Group
  transactionId?: number;             //      x
  groupId?: number;                   //              x
  description: string;                //      x       x
  validStart: string;                 //      x       x
  updatedAt: string;                  //      x       x
  sdkTransactionId?: string;          //      x
  transactionType?: string;           //      x
  groupItemCount?: number;            //              x
}

export enum TransactionNodeCollection {
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  READY_TO_SIGN = "READY_TO_SIGN",
  READY_FOR_EXECUTION = "READY_FOR_EXECUTION",
  IN_PROGRESS = "IN_PROGRESS",
  HISTORY = "HISTORY",
}


/*

    ITransactionNode | Single Transaction | Transaction Group    |
    ---------------- + ------------------ + -------------------- +
    transactionId    | tx id              | undefined            |
    groupId          | undefined          | group id             |
    description      | tx description     | group description    |
    validStart       | tx valid start     | min item valid start |
    updatedAt        | tx updated at      | max item updated at  |
    groupItemCount   | 0                  | group item count     |
    sdkTransactionId | hiero tx id        | undefined            |

 */
