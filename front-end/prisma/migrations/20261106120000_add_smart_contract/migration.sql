-- CreateTable
CREATE TABLE "SmartContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contract_id" TEXT,
    "evm_address" TEXT,
    "nickname" TEXT,
    "abi" TEXT NOT NULL,
    "roles" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmartContract_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
