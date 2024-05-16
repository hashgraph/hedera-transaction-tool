/*
  Warnings:

  - Added the required column `network` to the `HederaFile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `network` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `network` to the `HederaAccount` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HederaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "nickname" TEXT,
    "description" TEXT,
    "metaBytes" TEXT,
    "contentBytes" TEXT,
    "lastRefreshed" DATETIME,
    CONSTRAINT "HederaFile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaFile" ("contentBytes", "description", "file_id", "id", "lastRefreshed", "metaBytes", "nickname", "user_id") SELECT "contentBytes", "description", "file_id", "id", "lastRefreshed", "metaBytes", "nickname", "user_id" FROM "HederaFile";
DROP TABLE "HederaFile";
ALTER TABLE "new_HederaFile" RENAME TO "HederaFile";
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
    "group_id" TEXT,
    "creator_public_key" TEXT,
    "organizationId" TEXT,
    "network" TEXT NOT NULL,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "organizationId", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start") SELECT "body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "organizationId", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE TABLE "new_HederaAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    CONSTRAINT "HederaAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaAccount" ("account_id", "id", "nickname", "user_id") SELECT "account_id", "id", "nickname", "user_id" FROM "HederaAccount";
DROP TABLE "HederaAccount";
ALTER TABLE "new_HederaAccount" RENAME TO "HederaAccount";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
