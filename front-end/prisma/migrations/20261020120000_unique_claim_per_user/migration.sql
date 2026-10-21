-- Retain the oldest claim deterministically before enforcing uniqueness.
DELETE FROM "Claim" AS duplicate
WHERE EXISTS (
  SELECT 1 FROM "Claim" AS canonical
  WHERE canonical."user_id" = duplicate."user_id"
    AND canonical."claim_key" = duplicate."claim_key"
    AND (canonical."created_at" < duplicate."created_at"
      OR (canonical."created_at" = duplicate."created_at" AND canonical."id" < duplicate."id"))
);
CREATE UNIQUE INDEX "Claim_user_id_claim_key_key" ON "Claim"("user_id", "claim_key");
