-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[];
