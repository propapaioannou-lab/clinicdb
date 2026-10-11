-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'ARRIVED', 'READY', 'WITH_DOCTOR', 'TO_PAY', 'DONE', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CalendarLayer" AS ENUM ('OFFICE', 'ONLINE', 'SURGERY', 'SPA');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('DOCTOR', 'NURSE', 'ROOM', 'OPERATING_ROOM', 'CABIN');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('BREAK', 'CONGRESS', 'LEAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('STAFF', 'ONLINE');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "labelEl" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'teal',
    "defaultMinutes" INTEGER NOT NULL DEFAULT 30,
    "layer" "CalendarLayer" NOT NULL DEFAULT 'OFFICE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "userId" TEXT,
    "locationId" TEXT,
    "hours" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patientId" TEXT,
    "typeId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "room" TEXT,
    "reason" TEXT,
    "source" "AppointmentSource" NOT NULL DEFAULT 'STAFF',
    "ghlId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmChannel" TEXT,
    "visitId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentEvent" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus",
    "byId" TEXT,
    "byName" TEXT,
    "details" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBlock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "resourceId" TEXT,
    "kind" "BlockKind" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_companyId_name_key" ON "Location"("companyId", "name");

-- CreateIndex
CREATE INDEX "AppointmentType_companyId_sortOrder_idx" ON "AppointmentType"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentType_companyId_labelEl_key" ON "AppointmentType"("companyId", "labelEl");

-- CreateIndex
CREATE INDEX "Resource_companyId_sortOrder_idx" ON "Resource"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_companyId_label_key" ON "Resource"("companyId", "label");

-- CreateIndex
CREATE INDEX "Appointment_companyId_startsAt_idx" ON "Appointment"("companyId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_resourceId_startsAt_idx" ON "Appointment"("resourceId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_companyId_status_startsAt_idx" ON "Appointment"("companyId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "AppointmentEvent_appointmentId_at_idx" ON "AppointmentEvent"("appointmentId", "at");

-- CreateIndex
CREATE INDEX "CalendarBlock_companyId_startsAt_idx" ON "CalendarBlock"("companyId", "startsAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AppointmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
