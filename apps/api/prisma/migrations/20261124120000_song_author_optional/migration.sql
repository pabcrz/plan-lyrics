-- The author became optional in the API (stored as an empty string) but the database still required 1 to 120 characters,
-- so creating or renaming a song without an author failed. The check now allows an empty author; the title stays 1 to 120.
ALTER TABLE "Song" DROP CONSTRAINT "Song_text_check";
ALTER TABLE "Song" ADD CONSTRAINT "Song_text_check" CHECK (char_length("title") BETWEEN 1 AND 120 AND char_length("author") BETWEEN 0 AND 120);
