-- Trigram search (fast "contains" and similarity search on names, phones, emails).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ListKind" AS ENUM ('MARITAL_STATUS', 'REFERRAL_SOURCE', 'TAX_OFFICE', 'FLAG_REASON', 'VISIT_TYPE', 'CONDITION');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactLanguage" AS ENUM ('EL', 'EN');

-- CreateEnum
CREATE TYPE "PatientFlag" AS ENUM ('NONE', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "PhoneType" AS ENUM ('MOBILE', 'HOME', 'WORK', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDoctor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "ListKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "surname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT,
    "searchName" TEXT NOT NULL,
    "sortName" TEXT NOT NULL,
    "birthDate" DATE,
    "sex" "Sex",
    "maritalStatusId" TEXT,
    "occupation" TEXT,
    "referralSourceId" TEXT,
    "referralNote" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" "ContactLanguage" NOT NULL DEFAULT 'EL',
    "area" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "amka" TEXT,
    "afm" TEXT,
    "taxOfficeId" TEXT,
    "eprescriptionCity" TEXT,
    "eprescriptionPhone" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "infectiousDiseases" TEXT,
    "treatingDoctorId" TEXT,
    "comments" TEXT,
    "flag" "PatientFlag" NOT NULL DEFAULT 'NONE',
    "flagNote" TEXT,
    "flagSetAt" TIMESTAMP(3),
    "flagSetById" TEXT,
    "ghlContactId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPhone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "digits" TEXT NOT NULL,
    "type" "PhoneType" NOT NULL DEFAULT 'MOBILE',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PatientPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEmail" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PatientEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFlagReason" (
    "patientId" TEXT NOT NULL,
    "listItemId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PatientFlagReason_pkey" PRIMARY KEY ("patientId","listItemId")
);

-- CreateIndex
CREATE INDEX "ListItem_companyId_kind_sortOrder_idx" ON "ListItem"("companyId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_companyId_kind_label_key" ON "ListItem"("companyId", "kind", "label");

-- CreateIndex
CREATE INDEX "Patient_companyId_sortName_idx" ON "Patient"("companyId", "sortName");

-- CreateIndex
CREATE INDEX "Patient_companyId_amka_idx" ON "Patient"("companyId", "amka");

-- CreateIndex
CREATE INDEX "Patient_searchName_idx" ON "Patient" USING GIN ("searchName" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_companyId_number_key" ON "Patient"("companyId", "number");

-- CreateIndex
CREATE INDEX "PatientPhone_patientId_idx" ON "PatientPhone"("patientId");

-- CreateIndex
CREATE INDEX "PatientPhone_companyId_digits_idx" ON "PatientPhone"("companyId", "digits");

-- CreateIndex
CREATE INDEX "PatientPhone_digits_idx" ON "PatientPhone" USING GIN ("digits" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PatientEmail_patientId_idx" ON "PatientEmail"("patientId");

-- CreateIndex
CREATE INDEX "PatientEmail_companyId_email_idx" ON "PatientEmail"("companyId", "email");

-- CreateIndex
CREATE INDEX "PatientEmail_email_idx" ON "PatientEmail" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PatientFlagReason_listItemId_idx" ON "PatientFlagReason"("listItemId");

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_maritalStatusId_fkey" FOREIGN KEY ("maritalStatusId") REFERENCES "ListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_taxOfficeId_fkey" FOREIGN KEY ("taxOfficeId") REFERENCES "ListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_treatingDoctorId_fkey" FOREIGN KEY ("treatingDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhone" ADD CONSTRAINT "PatientPhone_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEmail" ADD CONSTRAINT "PatientEmail_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFlagReason" ADD CONSTRAINT "PatientFlagReason_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFlagReason" ADD CONSTRAINT "PatientFlagReason_listItemId_fkey" FOREIGN KEY ("listItemId") REFERENCES "ListItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
