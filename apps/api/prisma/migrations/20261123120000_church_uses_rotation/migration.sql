-- Additive: one new column on "Church". The rotation becomes opt-in per church, off by default. A church that already had
-- a role with its rotation on keeps it on, so nothing it relies on stops working; every other church starts with it off.
ALTER TABLE "Church" ADD COLUMN "usesRotation" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Church" SET "usesRotation" = true
WHERE EXISTS (SELECT 1 FROM "RolePlan" WHERE "RolePlan"."churchId" = "Church"."id" AND "RolePlan"."rotationOn");
