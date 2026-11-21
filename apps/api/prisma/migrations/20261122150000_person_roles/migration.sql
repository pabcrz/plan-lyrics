-- AlterTable
ALTER TABLE "ChurchPerson" ADD COLUMN "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Everyone keeps the roles they could be given until now; from here on an administrator narrows them.
UPDATE "ChurchPerson" cp
SET "roleIds" = COALESCE((SELECT array_agg(r."id") FROM "MusicalRole" r WHERE r."churchId" = cp."churchId"), ARRAY[]::TEXT[]);
