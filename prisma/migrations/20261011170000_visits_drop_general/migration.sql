-- 11 Oct 2026 (owner): "Γενικά · αίτημα ασθενούς" is not needed. Any text there is kept by
-- moving it into the visit's diagnosis/comment, so nothing is lost.
UPDATE "Visit" SET "diagnosis" = TRIM(BOTH ' ' FROM COALESCE("diagnosis", '') || ' ' || "general")
  WHERE "general" IS NOT NULL AND "general" <> '';
ALTER TABLE "Visit" DROP COLUMN "general";
