/*
  Warnings:

  - You are about to drop the column `group_id` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Transaction` table. All the data in the column will be lost.

*/
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

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "transaction_hash" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "valid_start" TEXT NOT NULL,
    "executed_at" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "creator_public_key" TEXT,
    "organization_id" TEXT,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("body", "created_at", "creator_public_key", "description", "executed_at", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start") SELECT "body", "created_at", "creator_public_key", "description", "executed_at", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "GroupItem_transaction_group_id_seq_key" ON "GroupItem"("transaction_group_id", "seq");
