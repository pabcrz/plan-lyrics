-- Additive only: two nullable columns with their checks. No existing row, column or constraint is changed or dropped.

-- AlterTable
ALTER TABLE "SongLyrics" ADD COLUMN "key" TEXT;
ALTER TABLE "SongLyrics" ADD CONSTRAINT "SongLyrics_key_check" CHECK ("key" IS NULL OR "key" ~ '^(C|C#|Db|D|D#|Eb|E|F|F#|Gb|G|G#|Ab|A|A#|Bb|B)m?$');

-- AlterTable
ALTER TABLE "LyricsSection" ADD COLUMN "chordPro" TEXT;
ALTER TABLE "LyricsSection" ADD CONSTRAINT "LyricsSection_chordPro_check" CHECK ("chordPro" IS NULL OR char_length("chordPro") BETWEEN 1 AND 8000);
