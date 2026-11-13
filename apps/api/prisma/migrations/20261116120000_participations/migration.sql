-- CreateEnum
CREATE TYPE "RotationMode" AS ENUM ('BY_DAY', 'SHARED');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('HABITUAL', 'ROTATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "PendingReason" AS ENUM ('COMBINATION', 'ROLE_REMOVED');

-- CreateTable
CREATE TABLE "RolePlan" (
    "roleId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "habitualIds" TEXT[],
    "rotationOn" BOOLEAN NOT NULL DEFAULT false,
    "mode" "RotationMode" NOT NULL DEFAULT 'BY_DAY',
    "startsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePlan_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "RotationSequence" (
    "roleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "memberIds" TEXT[],
    "nextPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationSequence_pkey" PRIMARY KEY ("roleId","weekday")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "roleId" TEXT,
    "roleName" TEXT NOT NULL,
    "personId" TEXT,
    "source" "AssignmentSource" NOT NULL,
    "pending" "PendingReason",
    "proposedPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_churchId_roleId_idx" ON "Assignment"("churchId", "roleId");

-- CreateIndex
CREATE INDEX "Assignment_serviceId_idx" ON "Assignment"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_serviceId_roleId_personId_key" ON "Assignment"("serviceId", "roleId", "personId");

-- AddForeignKey
ALTER TABLE "RolePlan" ADD CONSTRAINT "RolePlan_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "MusicalRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePlan" ADD CONSTRAINT "RolePlan_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationSequence" ADD CONSTRAINT "RotationSequence_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RolePlan"("roleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "MusicalRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_churchId_personId_fkey" FOREIGN KEY ("churchId", "personId") REFERENCES "ChurchPerson"("churchId", "personId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A row has a person or a pending marker, never both and never neither.
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_person_or_pending" CHECK (("personId" IS NULL) = ("pending" IS NOT NULL));
