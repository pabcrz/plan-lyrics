-- Additive only: two new tables and one new enum. No existing table, column or row is touched.

-- CreateEnum
CREATE TYPE "LyricsSectionKind" AS ENUM ('INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'CLOSING');

-- CreateTable
CREATE TABLE "SongLyrics" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongLyrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SongLyrics_version_check" CHECK ("version" >= 1)
);

-- CreateTable
CREATE TABLE "LyricsSection" (
    "id" TEXT NOT NULL,
    "lyricsId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "LyricsSectionKind" NOT NULL,
    "label" TEXT,
    "text" TEXT NOT NULL,
    "repeat" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LyricsSection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LyricsSection_position_check" CHECK ("position" >= 0),
    CONSTRAINT "LyricsSection_text_check" CHECK (char_length("text") BETWEEN 1 AND 4000),
    CONSTRAINT "LyricsSection_label_check" CHECK ("label" IS NULL OR char_length("label") BETWEEN 1 AND 60),
    CONSTRAINT "LyricsSection_repeat_check" CHECK ("repeat" BETWEEN 1 AND 8)
);

-- CreateIndex
CREATE UNIQUE INDEX "SongLyrics_songId_key" ON "SongLyrics"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "LyricsSection_lyricsId_position_key" ON "LyricsSection"("lyricsId", "position");

-- AddForeignKey
ALTER TABLE "SongLyrics" ADD CONSTRAINT "SongLyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricsSection" ADD CONSTRAINT "LyricsSection_lyricsId_fkey" FOREIGN KEY ("lyricsId") REFERENCES "SongLyrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
