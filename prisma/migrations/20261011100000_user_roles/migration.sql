-- Roles (SPEC §11): the job someone does, next to their level.
CREATE TYPE "Role" AS ENUM ('SURGEON', 'PA_NURSE', 'SECRETARY', 'SPA_STAFF', 'OTHER');
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'OTHER';

-- Existing owners are the surgeon; the "doctor" tick from step 1 was never used.
UPDATE "User" SET "role" = 'SURGEON' WHERE "level" = 'OWNER' OR "isDoctor";
ALTER TABLE "User" DROP COLUMN "isDoctor";
