-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HederaAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HederaAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaAccount" ("account_id", "id", "network", "nickname", "user_id") SELECT "account_id", "id", "network", "nickname", "user_id" FROM "HederaAccount";
DROP TABLE "HederaAccount";
ALTER TABLE "new_HederaAccount" RENAME TO "HederaAccount";
CREATE TABLE "new_HederaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nickname" TEXT,
    "description" TEXT,
    "metaBytes" TEXT,
    "contentBytes" TEXT,
    "lastRefreshed" DATETIME,
    CONSTRAINT "HederaFile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaFile" ("contentBytes", "description", "file_id", "id", "lastRefreshed", "metaBytes", "network", "nickname", "user_id") SELECT "contentBytes", "description", "file_id", "id", "lastRefreshed", "metaBytes", "network", "nickname", "user_id" FROM "HederaFile";
DROP TABLE "HederaFile";
ALTER TABLE "new_HederaFile" RENAME TO "HederaFile";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
