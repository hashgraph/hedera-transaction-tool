/*
  Warnings:

  - You are about to drop the column `email` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Organization` table. All the data in the column will be lost.
  - Added the required column `key` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nickname` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serverUrl` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "OrganizationCredentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "OrganizationCredentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrganizationCredentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "key" TEXT NOT NULL
);
INSERT INTO "new_Organization" ("id") SELECT "id" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_nickname_key" ON "Organization"("nickname");
CREATE UNIQUE INDEX "Organization_serverUrl_key" ON "Organization"("serverUrl");
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
    "organization_id" TEXT,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start") SELECT "body", "created_at", "creator_public_key", "description", "executed_at", "group_id", "id", "name", "signature", "status", "status_code", "transaction_hash", "transaction_id", "type", "updated_at", "user_id", "valid_start" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
