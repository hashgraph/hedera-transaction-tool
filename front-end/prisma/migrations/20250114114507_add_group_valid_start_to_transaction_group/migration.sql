-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransactionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "atomic" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupValidStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TransactionGroup" ("atomic", "created_at", "description", "id") SELECT "atomic", "created_at", "description", "id" FROM "TransactionGroup";
DROP TABLE "TransactionGroup";
ALTER TABLE "new_TransactionGroup" RENAME TO "TransactionGroup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
