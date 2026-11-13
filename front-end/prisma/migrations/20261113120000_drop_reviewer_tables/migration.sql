-- The organization backend is the authority for reviewer groups, rules and review records, so
-- these local mirrors are unused (see #3194). Indexes are dropped with their tables.

-- DropTable
DROP TABLE "TransactionReviewerListMember";

-- DropTable
DROP TABLE "TransactionReviewerList";

-- DropTable
DROP TABLE "ReviewerRule";

-- DropTable
DROP TABLE "ReviewerGroupMember";

-- DropTable
DROP TABLE "ReviewerGroup";
