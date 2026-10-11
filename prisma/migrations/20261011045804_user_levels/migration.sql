-- Replace isAdmin + per-company roles with one user level (SPEC §11).
CREATE TYPE "Level" AS ENUM ('OWNER', 'ADMIN', 'USER', 'GUEST');

ALTER TABLE "User"
  ADD COLUMN "level" "Level" NOT NULL DEFAULT 'USER',
  ADD COLUMN "accessExpiresAt" TIMESTAMP(3);

-- Existing admins (the first account) become Owners.
UPDATE "User" SET "level" = 'OWNER' WHERE "isAdmin";

ALTER TABLE "User"
  DROP COLUMN "isAdmin",
  DROP COLUMN "mustChangePassword";

-- Membership is now plain company access.
ALTER TABLE "Membership" DROP COLUMN "role";
DROP TYPE "Role";

-- A Guest account must always have an end date.
ALTER TABLE "User" ADD CONSTRAINT "User_guest_needs_end_date"
  CHECK ("level" <> 'GUEST' OR "accessExpiresAt" IS NOT NULL);
