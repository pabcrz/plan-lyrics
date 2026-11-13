-- AlterTable
ALTER TABLE "Service" ADD COLUMN "setlistVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "authorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Song_text_check" CHECK (char_length("title") BETWEEN 1 AND 120 AND char_length("author") BETWEEN 1 AND 120)
);

-- CreateTable
CREATE TABLE "SetlistEntry" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "songId" TEXT,
    "moment" TEXT,
    "key" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetlistEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SetlistEntry_position_check" CHECK ("position" >= 0),
    -- Exactly one of song / moment; a key and a link only make sense on a song.
    CONSTRAINT "SetlistEntry_kind_check" CHECK (
        ("songId" IS NOT NULL AND "moment" IS NULL)
        OR ("songId" IS NULL AND "moment" IS NOT NULL AND "key" IS NULL AND "link" IS NULL)
    ),
    CONSTRAINT "SetlistEntry_moment_check" CHECK ("moment" IS NULL OR char_length("moment") BETWEEN 1 AND 60)
);

-- CreateIndex
CREATE UNIQUE INDEX "Song_titleKey_authorKey_key" ON "Song"("titleKey", "authorKey");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistEntry_serviceId_songId_key" ON "SetlistEntry"("serviceId", "songId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistEntry_serviceId_position_key" ON "SetlistEntry"("serviceId", "position");

-- AddForeignKey
ALTER TABLE "SetlistEntry" ADD CONSTRAINT "SetlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistEntry" ADD CONSTRAINT "SetlistEntry_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
