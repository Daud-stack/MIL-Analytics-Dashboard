-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "episodeKey" TEXT NOT NULL,
    "month" INTEGER,
    "admDate" TIMESTAMP(3),
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "los" DOUBLE PRECISION,
    "doctor" TEXT,
    "specialty" TEXT,
    "medAid" TEXT,
    "ward" TEXT,
    "icdCode" TEXT,
    "cptCode" TEXT,
    "gender" TEXT,
    "ageGroup" TEXT,
    "city" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_orgId_idx" ON "api_keys"("orgId");

-- CreateIndex
CREATE INDEX "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");

-- CreateIndex
CREATE INDEX "episodes_orgId_year_month_idx" ON "episodes"("orgId", "year", "month");

-- CreateIndex
CREATE INDEX "episodes_orgId_year_doctor_idx" ON "episodes"("orgId", "year", "doctor");

-- CreateIndex
CREATE INDEX "episodes_orgId_year_medAid_idx" ON "episodes"("orgId", "year", "medAid");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_orgId_year_episodeKey_key" ON "episodes"("orgId", "year", "episodeKey");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

