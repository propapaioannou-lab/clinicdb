-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");
