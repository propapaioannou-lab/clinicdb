-- 11 Oct 2026 (owner): the "comments" field came from the old my-medical system and caused
-- confusion; it is removed from patient data. Newsletter consent moves to the consent
-- forms (SPEC §7).
ALTER TABLE "Patient" DROP COLUMN "comments";
ALTER TABLE "Patient" DROP COLUMN "marketingConsent";

-- Sensitive answers: only Surgeon, PA/nurse and Secretary may see them.
UPDATE "HistoryQuestion" SET "sensitive" = true WHERE "key" IN ('hiv', 'hepb', 'hepc', 'otherinf', 'drugs', 'mental');
