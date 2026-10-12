-- AlterTable
ALTER TABLE "AppointmentType" ADD COLUMN     "forNewPatients" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
