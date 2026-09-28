-- CreateTable
CREATE TABLE "ReviewerGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "threshold" INTEGER NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "attestationSignatures" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewerGroupMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userKeyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReviewerGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewerRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "hederaEntityId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "entityRole" TEXT,
    "transactionType" TEXT,
    "condition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewerRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReviewerGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
-- Hand-written: Prisma's @@unique cannot express a functional/COALESCE index, and
-- SQLite treats two NULLs as distinct, so a plain unique constraint would allow
-- duplicate rules whenever entityRole and/or transactionType are both null. This
-- mirrors the COALESCE unique index used by the back-end (#3184).
CREATE UNIQUE INDEX "ReviewerRule_entity_network_group_role_type_key" ON "ReviewerRule" ("hederaEntityId", "network", "groupId", COALESCE("entityRole", ''), COALESCE("transactionType", ''));

-- CreateTable
CREATE TABLE "TransactionReviewerList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "threshold" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TransactionReviewerListMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userKeyId" INTEGER,
    "signature" BLOB,
    "accepted" BOOLEAN,
    "note" TEXT,
    "actionedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionReviewerListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TransactionReviewerList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerGroupMember_groupId_userId_key" ON "ReviewerGroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionReviewerListMember_listId_userId_key" ON "TransactionReviewerListMember"("listId", "userId");
