-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HederaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "nickname" TEXT,
    "description" TEXT,
    "metaBytes" TEXT,
    "contentBytes" TEXT,
    CONSTRAINT "HederaFile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaFile" ("contentBytes", "description", "file_id", "id", "metaBytes", "nickname", "user_id") SELECT "contentBytes", "description", "file_id", "id", "metaBytes", "nickname", "user_id" FROM "HederaFile";
DROP TABLE "HederaFile";
ALTER TABLE "new_HederaFile" RENAME TO "HederaFile";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
