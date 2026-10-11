-- 11 Oct 2026 (owner): blood pressure and pulse are not recorded at visits.
ALTER TABLE "Visit" DROP COLUMN "bpSystolic";
ALTER TABLE "Visit" DROP COLUMN "bpDiastolic";
ALTER TABLE "Visit" DROP COLUMN "pulse";
