/*
  Warnings:

  - Added the required column `description` to the `TransactionDraft` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransactionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionBytes" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isTemplate" BOOLEAN DEFAULT false,
    "details" TEXT,
    CONSTRAINT "TransactionDraft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TransactionDraft" ("created_at", "details", "id", "isTemplate", "transactionBytes", "type", "updated_at", "user_id") SELECT "created_at", "details", "id", "isTemplate", "transactionBytes", "type", "updated_at", "user_id" FROM "TransactionDraft";
DROP TABLE "TransactionDraft";
ALTER TABLE "new_TransactionDraft" RENAME TO "TransactionDraft";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
