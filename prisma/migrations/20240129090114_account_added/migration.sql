-- CreateTable
CREATE TABLE "HederaAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    CONSTRAINT "HederaAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
