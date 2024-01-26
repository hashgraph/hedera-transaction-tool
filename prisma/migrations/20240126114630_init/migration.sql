-- CreateTable
CREATE TABLE "Migration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
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
    "key_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "valid_start" TEXT NOT NULL,
    "executed_at" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "group_id" TEXT
);
