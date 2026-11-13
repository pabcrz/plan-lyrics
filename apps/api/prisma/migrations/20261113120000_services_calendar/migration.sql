-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceSlot" AS ENUM ('SINGLE', 'MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "Church" ADD COLUMN "sundayDouble" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceDay" (
    "churchId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "slot" "ServiceSlot" NOT NULL DEFAULT 'SINGLE',
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDay_pkey" PRIMARY KEY ("churchId","weekday","slot"),
    CONSTRAINT "ServiceDay_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "ServiceDay_time_check" CHECK ("time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" "ServiceSlot" NOT NULL DEFAULT 'SINGLE',
    "time" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "directorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Service_time_check" CHECK ("time" IS NULL OR "time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

-- CreateIndex
CREATE INDEX "Service_churchId_date_idx" ON "Service"("churchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Service_churchId_date_slot_key" ON "Service"("churchId", "date", "slot");

-- AddForeignKey
ALTER TABLE "ServiceDay" ADD CONSTRAINT "ServiceDay_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_churchId_directorId_fkey" FOREIGN KEY ("churchId", "directorId") REFERENCES "ChurchPerson"("churchId", "personId") ON DELETE RESTRICT ON UPDATE CASCADE;
