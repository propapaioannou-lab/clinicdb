-- CreateTable
CREATE TABLE "DeletedUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "companies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedById" TEXT NOT NULL,
    "deletedByEmail" TEXT NOT NULL,

    CONSTRAINT "DeletedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedUser_userId_key" ON "DeletedUser"("userId");

-- CreateIndex
CREATE INDEX "DeletedUser_deletedAt_idx" ON "DeletedUser"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedUser_email_idx" ON "DeletedUser"("email");
