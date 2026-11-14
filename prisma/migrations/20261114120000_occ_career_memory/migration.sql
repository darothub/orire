CREATE TABLE "OccCareerProfile" (
  "userId" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL DEFAULT '',
  "location" TEXT NOT NULL DEFAULT '',
  "workMode" TEXT NOT NULL DEFAULT '',
  "salaryGoal" TEXT NOT NULL DEFAULT '',
  "careerGoal" TEXT NOT NULL DEFAULT '',
  "verifiedNotes" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccCareerProfile_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "OccAdviceRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "recommendations" JSONB NOT NULL,
  "nextSteps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccAdviceRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OccAdviceRun_userId_createdAt_idx" ON "OccAdviceRun"("userId","createdAt");
ALTER TABLE "OccCareerProfile" ADD CONSTRAINT "OccCareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccAdviceRun" ADD CONSTRAINT "OccAdviceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
