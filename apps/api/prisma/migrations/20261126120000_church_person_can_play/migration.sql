-- Grupo de alabanza por iglesia: solo quien está en el grupo puede tener roles musicales.
-- AlterTable
ALTER TABLE "ChurchPerson" ADD COLUMN     "canPlay" BOOLEAN NOT NULL DEFAULT false;

-- Nadie pierde sus roles: quien ya tiene roles musicales queda en el grupo; el resto se marca desde su ficha.
UPDATE "ChurchPerson" SET "canPlay" = true WHERE cardinality("roleIds") > 0;
