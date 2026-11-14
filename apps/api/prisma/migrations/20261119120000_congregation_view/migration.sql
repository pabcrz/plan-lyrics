-- AlterEnum
ALTER TYPE "ShareVersion" ADD VALUE 'CONGREGATION';

-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "congregationShowsPreacher" BOOLEAN NOT NULL DEFAULT false;

-- The congregation view has no optional blocks. The enum is compared as text: a value added in this same
-- transaction cannot be used as an enum literal until it commits.
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_congregation_check" CHECK ("version"::text <> 'CONGREGATION' OR (NOT "showKeys" AND NOT "showNotes" AND NOT "showPeople"));

