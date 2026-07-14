-- AlterTable
ALTER TABLE "ZymoConfigList" ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ZymoAreaPrefix" ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncedAt" TIMESTAMP(3);
