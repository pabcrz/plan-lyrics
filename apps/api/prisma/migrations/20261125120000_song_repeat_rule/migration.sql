-- Regla de repetición de canciones por iglesia: sin valores, la regla está apagada.
-- CreateEnum
CREATE TYPE "SongRepeatUnit" AS ENUM ('WEEKS', 'SERVICES');

-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "songRepeatUnit" "SongRepeatUnit",
ADD COLUMN     "songRepeatAmount" INTEGER;
