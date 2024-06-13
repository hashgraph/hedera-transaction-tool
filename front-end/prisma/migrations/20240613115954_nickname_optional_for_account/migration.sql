-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HederaAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "nickname" TEXT,
    "network" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HederaAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HederaAccount" ("account_id", "created_at", "id", "network", "nickname", "user_id") SELECT "account_id", "created_at", "id", "network", "nickname", "user_id" FROM "HederaAccount";
DROP TABLE "HederaAccount";
ALTER TABLE "new_HederaAccount" RENAME TO "HederaAccount";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
