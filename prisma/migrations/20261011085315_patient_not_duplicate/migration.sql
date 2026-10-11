-- CreateTable
CREATE TABLE "PatientNotDuplicate" (
    "companyId" TEXT NOT NULL,
    "patientAId" TEXT NOT NULL,
    "patientBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PatientNotDuplicate_pkey" PRIMARY KEY ("patientAId","patientBId")
);

-- CreateIndex
CREATE INDEX "PatientNotDuplicate_patientBId_idx" ON "PatientNotDuplicate"("patientBId");

-- AddForeignKey
ALTER TABLE "PatientNotDuplicate" ADD CONSTRAINT "PatientNotDuplicate_patientAId_fkey" FOREIGN KEY ("patientAId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNotDuplicate" ADD CONSTRAINT "PatientNotDuplicate_patientBId_fkey" FOREIGN KEY ("patientBId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
