-- Drop the Teams/seats (Phase B3) tables. The schema was fully built
-- (Team, TeamMember, TeamInvite, TeamKey, TeamAudit across three migrations:
-- 20260930160336_teams_seats, 20260930162441_team_pooled_keys,
-- 20261002180909_team_audit_log) but no application code was ever built on
-- top of it beyond incidental reads in account.ts's delete-account cascade
-- guard, which is being removed in the same change. Decision: drop the dead
-- schema rather than carry its migration/audit surface indefinitely.
--
-- Dropped in FK-dependency order (children before parents); each table's
-- own foreign keys go with it automatically.

-- DropTable
DROP TABLE "TeamAudit";

-- DropTable
DROP TABLE "TeamKey";

-- DropTable
DROP TABLE "TeamInvite";

-- DropTable
DROP TABLE "TeamMember";

-- DropTable
DROP TABLE "Team";
