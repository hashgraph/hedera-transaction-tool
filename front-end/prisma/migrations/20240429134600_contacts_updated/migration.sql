/*
  Warnings:

  - You are about to drop the `AssociatedAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContactPublicKey` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "AssociatedAccount";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "Contact";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "ContactPublicKey";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "organization_user_id_owner" INTEGER NOT NULL,
    "organization_user_id" INTEGER NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    CONSTRAINT "Contact_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contact_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicKeyLinked" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    CONSTRAINT "PublicKeyLinked_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
