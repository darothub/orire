-- Reshape UsageCounter from a monthly refine-only counter into a generic
-- (metric, period) counter supporting lifetime (Free) and monthly (Pro refine)
-- scopes across refine / simulate / download.
--
-- Pre-launch: there is no production usage to preserve, so existing counter
-- rows are discarded. (If this ever runs against real data, those monthly
-- refine tallies are intentionally reset.)

TRUNCATE TABLE "UsageCounter";

-- Old shape
DROP INDEX IF EXISTS "UsageCounter_userId_month_key";
ALTER TABLE "UsageCounter" DROP COLUMN "month";
ALTER TABLE "UsageCounter" DROP COLUMN "refinesUsed";

-- New shape
ALTER TABLE "UsageCounter" ADD COLUMN "metric" TEXT NOT NULL;
ALTER TABLE "UsageCounter" ADD COLUMN "period" TEXT NOT NULL;
ALTER TABLE "UsageCounter" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "UsageCounter_userId_metric_period_key" ON "UsageCounter"("userId", "metric", "period");
CREATE INDEX "UsageCounter_userId_idx" ON "UsageCounter"("userId");
