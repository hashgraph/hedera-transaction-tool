/*
  Warnings:

  - You are about to drop the column `organization_id` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "unique_user_key";

-- AlterTable
ALTER TABLE "KeyPair" ADD COLUMN "organization_user_id" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationCredentials" ADD COLUMN "organization_user_id" INTEGER;
ALTER TABLE "OrganizationCredentials" ADD COLUMN "updated_at" DATETIME;

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
    "group_id" TEXT,
    "creator_public_key" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start") SELECT "body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
