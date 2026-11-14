-- CreateEnum
CREATE TYPE "ShareVersion" AS ENUM ('PRAISE', 'PREACHING', 'FULL');

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "version" "ShareVersion" NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "serviceId" TEXT,
    "showKeys" BOOLEAN NOT NULL DEFAULT false,
    "showNotes" BOOLEAN NOT NULL DEFAULT false,
    "showPeople" BOOLEAN NOT NULL DEFAULT true,
    "activeUntil" DATE NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "reactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShareLink_range_check" CHECK ("fromDate" <= "toDate"),
    CONSTRAINT "ShareLink_service_check" CHECK ("serviceId" IS NULL OR "fromDate" = "toDate"),
    CONSTRAINT "ShareLink_blocks_check" CHECK (NOT ("version" = 'PRAISE' AND "showNotes") AND NOT ("version" = 'PREACHING' AND "showKeys"))
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareLink_churchId_createdAt_idx" ON "ShareLink"("churchId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_serviceId_churchId_fkey" FOREIGN KEY ("serviceId", "churchId") REFERENCES "Service"("id", "churchId") ON DELETE CASCADE ON UPDATE CASCADE;

