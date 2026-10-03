-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "employerId" TEXT,
    "recruiterId" TEXT,
    "createdById" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "planBefore" JSONB,
    "planAfter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_code_key" ON "PaymentOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_number_key" ON "PaymentOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_providerRef_key" ON "PaymentOrder"("providerRef");

-- CreateIndex
CREATE INDEX "PaymentOrder_employerId_createdAt_idx" ON "PaymentOrder"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_recruiterId_createdAt_idx" ON "PaymentOrder"("recruiterId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");
