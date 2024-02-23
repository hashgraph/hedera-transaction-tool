-- CreateTable
CREATE TABLE "TransactionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionBytes" TEXT NOT NULL,
    "details" TEXT,
    CONSTRAINT "TransactionDraft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
