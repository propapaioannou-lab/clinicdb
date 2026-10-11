-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "chargeable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultFeeCents" INTEGER;

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "typeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorId" TEXT,
    "general" TEXT,
    "areas" JSONB,
    "procedures" JSONB,
    "diagnosis" TEXT,
    "weightKg" DECIMAL(5,1),
    "heightCm" DECIMAL(5,1),
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "feeCents" INTEGER,
    "paidCents" INTEGER,
    "paymentMethod" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_patientId_startedAt_idx" ON "Visit"("patientId", "startedAt");

-- CreateIndex
CREATE INDEX "Visit_companyId_startedAt_idx" ON "Visit"("companyId", "startedAt");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11 Oct 2026 (owner): consultation visits are charged, follow-ups are not.
UPDATE "ListItem" SET "chargeable" = true WHERE "kind" = 'VISIT_TYPE' AND "label" = 'Πρώτη επίσκεψη';
