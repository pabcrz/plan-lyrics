-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountManager" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChurchPerson" (
    "churchId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchPerson_pkey" PRIMARY KEY ("churchId","personId")
);

-- Preserve existing links from the implicit relation table ("A" = Church, "B" = Person).
INSERT INTO "ChurchPerson" ("churchId", "personId", "updatedAt")
SELECT "A", "B", CURRENT_TIMESTAMP FROM "_ChurchToPerson";

-- DropTable
DROP TABLE "_ChurchToPerson";

-- CreateIndex
CREATE INDEX "ChurchPerson_personId_idx" ON "ChurchPerson"("personId");

-- AddForeignKey
ALTER TABLE "ChurchPerson" ADD CONSTRAINT "ChurchPerson_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchPerson" ADD CONSTRAINT "ChurchPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
