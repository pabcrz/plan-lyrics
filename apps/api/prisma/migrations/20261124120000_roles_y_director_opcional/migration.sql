-- AlterTable
ALTER TABLE "ChurchPerson" ADD COLUMN     "canDirect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canPreach" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: un servicio puede tener solo predicación; la llave compuesta no se aplica con directorId nulo.
ALTER TABLE "Service" ALTER COLUMN "directorId" DROP NOT NULL;

-- Nadie pierde acceso: hasta ahora cualquier persona podía dirigir, y quien ya predicó puede seguir haciéndolo.
UPDATE "ChurchPerson" SET "canDirect" = true;
UPDATE "ChurchPerson" cp SET "canPreach" = true
WHERE EXISTS (SELECT 1 FROM "ServicePreaching" sp WHERE sp."churchId" = cp."churchId" AND sp."preacherId" = cp."personId");
