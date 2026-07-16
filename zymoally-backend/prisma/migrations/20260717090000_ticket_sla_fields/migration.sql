-- AlterTable
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ZymoConfigList" ADD COLUMN "slaHours" INTEGER;
