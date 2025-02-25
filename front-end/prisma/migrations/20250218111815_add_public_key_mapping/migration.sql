-- CreateTable
CREATE TABLE "PublicKeyMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "public_key" TEXT NOT NULL,
    "nickname" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicKeyMapping_public_key_key" ON "PublicKeyMapping"("public_key");
