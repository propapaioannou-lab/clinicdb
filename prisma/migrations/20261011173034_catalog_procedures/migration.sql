-- CreateTable
CREATE TABLE "CatalogProcedure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "labelEl" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nonSurgical" BOOLEAN NOT NULL DEFAULT false,
    "subs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogProcedure_companyId_area_sortOrder_idx" ON "CatalogProcedure"("companyId", "area", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProcedure_companyId_key_key" ON "CatalogProcedure"("companyId", "key");
