-- CreateTable
CREATE TABLE "TransactionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "atomic" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GroupItem" (
    "transaction_id" TEXT,
    "transaction_draft_id" TEXT,
    "transaction_group_id" TEXT NOT NULL,
    "seq" TEXT NOT NULL,
    CONSTRAINT "GroupItem_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GroupItem_transaction_draft_id_fkey" FOREIGN KEY ("transaction_draft_id") REFERENCES "TransactionDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GroupItem_transaction_group_id_fkey" FOREIGN KEY ("transaction_group_id") REFERENCES "TransactionGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupItem_transaction_group_id_seq_key" ON "GroupItem"("transaction_group_id", "seq");
