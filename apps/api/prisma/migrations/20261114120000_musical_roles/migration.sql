-- AlterTable
ALTER TABLE "Church" ADD COLUMN "rolesSeeded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MusicalRole" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicalRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRestriction" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "first" TEXT NOT NULL,
    "second" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicalRole_churchId_nameKey_key" ON "MusicalRole"("churchId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "RoleRestriction_churchId_first_second_key" ON "RoleRestriction"("churchId", "first", "second");

-- AddForeignKey
ALTER TABLE "MusicalRole" ADD CONSTRAINT "MusicalRole_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRestriction" ADD CONSTRAINT "RoleRestriction_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A pair is stored sorted, so a role is never paired with itself and (a, b) equals (b, a).
ALTER TABLE "RoleRestriction" ADD CONSTRAINT "RoleRestriction_sorted_check" CHECK ("first" COLLATE "C" < "second" COLLATE "C");
ALTER TABLE "MusicalRole" ADD CONSTRAINT "MusicalRole_name_check" CHECK (char_length("name") BETWEEN 1 AND 40);

-- Existing churches start with the default catalog and the default restriction (Dirigir + Batería).
-- New churches are seeded by the API the first time their roles are read.
INSERT INTO "MusicalRole" ("id", "churchId", "name", "nameKey", "updatedAt")
SELECT 'role_' || md5(c."id" || r."key"), c."id", r."name", r."key", CURRENT_TIMESTAMP
FROM "Church" c
CROSS JOIN (VALUES ('Batería', 'bateria'), ('Guitarra', 'guitarra'), ('Piano', 'piano'), ('Voces', 'voces')) AS r("name", "key")
WHERE NOT c."rolesSeeded";

INSERT INTO "RoleRestriction" ("id", "churchId", "first", "second")
SELECT 'restriction_' || md5(c."id"), c."id", 'DIRIGIR', 'role_' || md5(c."id" || 'bateria')
FROM "Church" c
WHERE NOT c."rolesSeeded";

UPDATE "Church" SET "rolesSeeded" = true WHERE NOT "rolesSeeded";
