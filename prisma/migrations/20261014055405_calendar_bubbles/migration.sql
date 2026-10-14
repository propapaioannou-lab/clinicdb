-- CreateTable
CREATE TABLE "CalendarBubble" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patientId" TEXT,
    "newName" TEXT,
    "newMobile" TEXT,
    "typeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedWhy" TEXT,
    "appointmentId" TEXT,

    CONSTRAINT "CalendarBubble_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarBubble_companyId_closedAt_idx" ON "CalendarBubble"("companyId", "closedAt");

-- CreateIndex
CREATE INDEX "CalendarBubble_patientId_idx" ON "CalendarBubble"("patientId");

-- AddForeignKey
ALTER TABLE "CalendarBubble" ADD CONSTRAINT "CalendarBubble_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
