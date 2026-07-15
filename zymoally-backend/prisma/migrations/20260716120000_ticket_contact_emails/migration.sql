-- AlterTable
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "supervisorEmail" TEXT,
ADD COLUMN "analystEmail" TEXT,
ADD COLUMN "coordinatorEmail" TEXT,
ADD COLUMN "managerEmail" TEXT;

-- AlterTable
ALTER TABLE "ZymoConfigList" ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT;
