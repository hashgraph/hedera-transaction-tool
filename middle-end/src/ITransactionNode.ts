export interface ITransactionNode {
  transactionId?: string;
  groupId?: number;
  description: string;
  validStart: Date;
  updatedAt: Date;
  itemCount: number;
}

export enum TransactionNodeCollection {
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  READY_TO_SIGN = "READY_TO_SIGN",
  READY_FOR_EXECUTION = "READY_FOR_EXECUTION",
  IN_PROGRESS = "IN_PROGRESS",
  HISTORY = "HISTORY",
}

export const transactionNodeProperties: (keyof ITransactionNode)[] = [
  "transactionId",
  "groupId",
  "description",
  "validStart",
  "updatedAt",
  "itemCount",
];


/*

    ITransactionNode | Single Transaction | Transaction Group    |
    ---------------- + ------------------ + -------------------- +
    transactionId    | tx id              | undefined            |
    groupId          | undefined          | group id             |
    description      | tx description     | group description    |
    validStart       | tx valid start     | min item valid start |
    updatedAt        | tx updated at      | max item updated at  |
    itemCount        | 0                  | group item count     |

 */
