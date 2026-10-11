-- CreateEnum
CREATE TYPE "HistoryStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "HistorySource" AS ENUM ('STAFF', 'PATIENT', 'IMPORT');

-- CreateTable
CREATE TABLE "HistoryQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "labelEl" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "detailEl" TEXT,
    "detailEn" TEXT,
    "hintEl" TEXT,
    "hintEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "infection" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientHistory" (
    "patientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currentVersionId" TEXT NOT NULL,
    "status" "HistoryStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedRole" "Role",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientHistory_pkey" PRIMARY KEY ("patientId")
);

-- CreateTable
CREATE TABLE "PatientHistoryVersion" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "source" "HistorySource" NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "PatientHistoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoryQuestion_companyId_section_sortOrder_idx" ON "HistoryQuestion"("companyId", "section", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryQuestion_companyId_key_key" ON "HistoryQuestion"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistory_currentVersionId_key" ON "PatientHistory"("currentVersionId");

-- CreateIndex
CREATE INDEX "PatientHistory_companyId_status_idx" ON "PatientHistory"("companyId", "status");

-- CreateIndex
CREATE INDEX "PatientHistoryVersion_companyId_idx" ON "PatientHistoryVersion"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientHistoryVersion_patientId_number_key" ON "PatientHistoryVersion"("patientId", "number");

-- AddForeignKey
ALTER TABLE "HistoryQuestion" ADD CONSTRAINT "HistoryQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistory" ADD CONSTRAINT "PatientHistory_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "PatientHistoryVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistoryVersion" ADD CONSTRAINT "PatientHistoryVersion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
