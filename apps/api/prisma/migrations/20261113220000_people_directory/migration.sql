-- AlterTable
ALTER TABLE "Person" ADD COLUMN "phone" TEXT;
ALTER TABLE "Person" ADD CONSTRAINT "Person_phone_check" CHECK ("phone" IS NULL OR char_length("phone") BETWEEN 3 AND 30);

-- AlterTable
ALTER TABLE "ChurchPerson" ADD COLUMN "removedAt" TIMESTAMP(3);
