-- Reviewer tables still have no local data (feature flag off, nothing released), so they are
-- dropped and recreated rather than redefined.
-- Changes: #3194 dropped local chain-walk verification of reviewer group/rule changes in
-- favor of trusting the organization server outright, so ReviewerGroup.snapshotVersion and
-- .attestationSignatures (both only meaningful to that verification) are no longer stored.

DROP INDEX "ReviewerRule_entity_network_group_role_type_key";
DROP TABLE "ReviewerRule";
DROP TABLE "ReviewerGroupMember";
DROP TABLE "ReviewerGroup";

-- CreateTable
CREATE TABLE "ReviewerGroup" (
    "organizationId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "threshold" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("organizationId", "id"),
    CONSTRAINT "ReviewerGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewerGroupMember" (
    "organizationId" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userKeyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("organizationId", "groupId", "userId"),
    CONSTRAINT "ReviewerGroupMember_organizationId_groupId_fkey" FOREIGN KEY ("organizationId", "groupId") REFERENCES "ReviewerGroup" ("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewerRule" (
    "organizationId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "hederaId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "entityRole" TEXT,
    "transactionType" TEXT,
    "condition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("organizationId", "id"),
    CONSTRAINT "ReviewerRule_organizationId_groupId_fkey" FOREIGN KEY ("organizationId", "groupId") REFERENCES "ReviewerGroup" ("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
-- Hand-written: Prisma's @@unique cannot express a functional/COALESCE index, and
-- SQLite treats two NULLs as distinct (see #3184 for the back-end equivalent).
CREATE UNIQUE INDEX "ReviewerRule_entity_network_group_role_type_key" ON "ReviewerRule" ("organizationId", "hederaId", "network", "groupId", COALESCE("entityRole", ''), COALESCE("transactionType", ''));
