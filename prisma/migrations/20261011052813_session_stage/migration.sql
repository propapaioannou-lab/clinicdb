-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "stage" "SessionStage" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "trustedDeviceId" TEXT;
